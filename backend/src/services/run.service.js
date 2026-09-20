import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../config/db.js";
import { queues } from "../config/queue.js";
import { UPLOAD_DIR } from "../middleware/upload.middleware.js";
import { enqueueExecuteRun } from "../jobs/producers.js";
import { ApiError } from "../utils/ApiError.js";
import { aiEngine } from "./aiEngine.client.js";
import { assertProjectAccess } from "./project.service.js";
import { rankTestCases } from "./prioritize.service.js";

export const SCREENSHOT_DIR = path.join(UPLOAD_DIR, "screenshots");
export const ACTIVE = ["QUEUED", "RUNNING"];
export const isApiCase = (tc) => tc.type === "API" || tc.platform === "API";

const round1 = (n) => Math.round(n * 10) / 10;
const pct = (a, b) => (b ? round1((a / b) * 100) : 0);

async function getRunOrThrow(id, user) {
  const run = await prisma.testRun.findUnique({ where: { id } });
  if (!run) throw ApiError.notFound("Test run not found");
  await assertProjectAccess(run.projectId, user);
  return run;
}

export async function nextRunCode() {
  const prefix = `TR-${new Date().getFullYear()}-`;
  const last = await prisma.testRun.findFirst({
    where: { runCode: { startsWith: prefix } },
    orderBy: { runCode: "desc" },
    select: { runCode: true },
  });
  const n = last ? parseInt(last.runCode.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(4, "0");
}

export const removeRunFiles = (projectId, runId) =>
  fs
    .rm(path.join(SCREENSHOT_DIR, projectId, runId), {
      recursive: true,
      force: true,
    })
    .catch(() => {});

// ───────── create / list / read ─────────

export async function createRun(projectId, user, opts) {
  const project = await assertProjectAccess(projectId, user);

  const active = await prisma.testRun.findFirst({
    where: { projectId, status: { in: ACTIVE } },
    select: { id: true },
  });
  if (active)
    throw ApiError.conflict(
      "A test run is already in progress for this project",
    );

  // All matching cases are candidates, so smart ordering can pick the best ones
  let cases = await prisma.testCase.findMany({
    where: {
      projectId,
      type: { in: opts.types },
      ...(opts.testCaseIds && { id: { in: opts.testCaseIds } }),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 500,
    select: {
      id: true,
      type: true,
      platform: true,
      priority: true,
      module: true,
    },
  });
  if (cases.length === 0) {
    throw ApiError.badRequest(
      "No test cases match. Generate test cases first, or pick other types.",
    );
  }

  if (opts.smartOrder && cases.length > 1) {
    cases = (await rankTestCases(projectId, cases)).ordered;
  }
  cases = cases.slice(0, opts.maxCases);

  const needsUi = cases.some((c) => !isApiCase(c));
  const needsApi = cases.some(isApiCase);
  const uiUrl = opts.targetUrl || project.baseUrl || null;
  const apiBase = opts.apiBaseUrl || opts.targetUrl || project.baseUrl || null;
  if (needsUi && !uiUrl)
    throw ApiError.badRequest("Enter the application URL for UI tests");
  if (needsApi && !apiBase)
    throw ApiError.badRequest("Enter an API base URL for API tests");

  let run;
  for (let attempt = 0; attempt < 3 && !run; attempt++) {
    try {
      run = await prisma.testRun.create({
        data: {
          runCode: await nextRunCode(),
          projectId,
          triggeredById: user.id,
          status: "QUEUED",
          stage: "queued",
          targetUrl: needsUi ? uiUrl : apiBase,
          total: cases.length,
        },
      });
    } catch (e) {
      if (e?.code !== "P2002" || attempt === 2) throw e; // run code collision: retry
    }
  }

  try {
    await enqueueExecuteRun({
      runId: run.id,
      caseIds: cases.map((c) => c.id),
      uiUrl: needsUi ? uiUrl : null,
      apiBase: needsApi ? apiBase : null,
      headless: opts.headless,
      authToken: opts.authToken || null,
    });
  } catch (e) {
    await prisma.testRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMsg: "Could not queue the run. Is Redis running?",
        finishedAt: new Date(),
      },
    });
    throw e;
  }
  return run;
}
export async function listRuns(projectId, user, q) {
  await assertProjectAccess(projectId, user);
  const where = { projectId, ...(q.status && { status: q.status }) };
  const [items, total] = await Promise.all([
    prisma.testRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { triggeredBy: { select: { name: true } } },
    }),
    prisma.testRun.count({ where }),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export async function getRun(id, user) {
  const run = await getRunOrThrow(id, user);
  const [groups, project, triggeredBy] = await Promise.all([
    prisma.testResult.groupBy({
      by: ["status"],
      where: { runId: id },
      _count: { _all: true },
    }),
    prisma.project.findUnique({
      where: { id: run.projectId },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: run.triggeredById },
      select: { name: true },
    }),
  ]);
  return {
    ...run,
    project,
    triggeredBy,
    breakdown: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
  };
}

export async function listResults(runId, user, q) {
  await getRunOrThrow(runId, user);
  const where = { runId, ...(q.status && { status: q.status }) };
  const [items, total] = await Promise.all([
    prisma.testResult.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        status: true,
        durationMs: true,
        errorMessage: true,
        screenshotPath: true,
        createdAt: true,
        testCase: {
          select: {
            id: true,
            title: true,
            type: true,
            module: true,
            priority: true,
            platform: true,
          },
        },
      },
    }),
    prisma.testResult.count({ where }),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export async function getResult(id, user) {
  const result = await prisma.testResult.findUnique({
    where: { id },
    include: {
      testCase: true,
      run: { select: { id: true, runCode: true, projectId: true } },
    },
  });
  if (!result) throw ApiError.notFound("Result not found");
  await assertProjectAccess(result.run.projectId, user);
  return result;
}

export async function getResultScreenshotFile(id, user) {
  const result = await getResult(id, user);
  if (!result.screenshotPath)
    throw ApiError.notFound("No screenshot for this result");

  const root = path.resolve(SCREENSHOT_DIR);
  const abs = path.resolve(root, result.screenshotPath);
  if (!abs.startsWith(root + path.sep))
    throw ApiError.notFound("Invalid screenshot path");
  await fs.access(abs).catch(() => {
    throw ApiError.notFound("The screenshot file is missing");
  });
  return abs;
}

// ───────── cancel / delete ─────────

export async function cancelRun(id, user) {
  const run = await getRunOrThrow(id, user);
  if (!ACTIVE.includes(run.status))
    throw ApiError.conflict("This run has already finished");

  const updated = await prisma.testRun.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  if (run.status === "QUEUED") {
    const job = await queues.EXECUTE_RUN.getJob(id);
    await job?.remove().catch(() => {});
  }
  return updated;
}

export async function deleteRun(id, user) {
  const run = await getRunOrThrow(id, user);
  if (ACTIVE.includes(run.status))
    throw ApiError.conflict("Cancel the run before deleting it");
  await prisma.testRun.delete({ where: { id } });
  await removeRunFiles(run.projectId, id);
}

// ───────── live snapshot (SSE and polling) ─────────

const STATE = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "failed",
};

function toSnapshot(run, jobProgress, recent) {
  const done = run.passed + run.failed + run.skipped;
  const finished = ["COMPLETED", "FAILED", "CANCELLED"].includes(run.status);

  let message;
  if (run.status === "QUEUED") message = "Waiting for the worker...";
  else if (run.status === "RUNNING")
    message = jobProgress?.message || "Running tests";
  else if (run.status === "COMPLETED") {
    message = `Finished: ${run.passed} passed, ${run.failed} failed, ${run.skipped} skipped`;
  } else if (run.status === "CANCELLED") message = "Run was cancelled";
  else message = run.errorMsg || "Run failed";

  return {
    jobId: run.id,
    runId: run.id,
    runCode: run.runCode,
    status: run.status,
    state: STATE[run.status],
    progress: {
      percent: run.status === "COMPLETED" ? 100 : run.progress,
      stage: run.stage,
      message,
      total: run.total,
      done,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped,
      current: jobProgress?.current ?? null,
    },
    recent: recent.map((r) => ({
      id: r.id,
      status: r.status,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage ? r.errorMessage.slice(0, 200) : null,
      at: r.createdAt,
      title: r.testCase.title,
      type: r.testCase.type,
    })),
    result: finished
      ? {
          runCode: run.runCode,
          passed: run.passed,
          failed: run.failed,
          skipped: run.skipped,
        }
      : null,
    error:
      run.status === "FAILED"
        ? run.errorMsg || "Run failed"
        : run.status === "CANCELLED"
          ? "Run was cancelled"
          : null,
  };
}

export async function readRunSnapshot(runId) {
  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run) throw ApiError.notFound("Test run not found");

  const [recent, job] = await Promise.all([
    prisma.testResult.findMany({
      where: { runId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        durationMs: true,
        errorMessage: true,
        createdAt: true,
        testCase: { select: { title: true, type: true } },
      },
    }),
    ACTIVE.includes(run.status) ? queues.EXECUTE_RUN.getJob(runId) : null,
  ]);

  const jobProgress =
    job && typeof job.progress === "object" ? job.progress : null;
  return toSnapshot(run, jobProgress, recent);
}

export async function getRunSnapshot(runId, user) {
  await getRunOrThrow(runId, user);
  return readRunSnapshot(runId);
}

// ───────── dashboard ─────────

export async function dashboardData(projectId, user) {
  await assertProjectAccess(projectId, user);

  const [totalCases, runs] = await Promise.all([
    prisma.testCase.count({ where: { projectId, NOT: { type: "MOBILE" } } }),
    prisma.testRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { project: { select: { name: true } } },
    }),
  ]);

  const latest = runs[0] ?? null;
  let latestRun = null;
  let bugs = 0;

  if (latest) {
    const [results, bugCount] = await Promise.all([
      prisma.testResult.findMany({
        where: { runId: latest.id },
        select: {
          status: true,
          testCase: { select: { type: true, platform: true, module: true } },
        },
      }),
      prisma.bug.count({ where: { runId: latest.id } }),
    ]);
    bugs = bugCount;

    const ui = { total: 0, passed: 0 };
    const api = { total: 0, passed: 0 };
    const modules = new Set();
    for (const r of results) {
      const bucket = isApiCase(r.testCase) ? api : ui;
      bucket.total += 1;
      if (r.status === "PASSED") bucket.passed += 1;
      if (r.testCase.module) modules.add(r.testCase.module);
    }

    latestRun = {
      id: latest.id,
      runCode: latest.runCode,
      status: latest.status,
      progress: latest.progress,
      total: latest.total,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      coverage: latest.coverage,
      errorMsg: latest.errorMsg,
      ui,
      api,
      scenarios: modules.size,
    };
  }

  const executed = latest ? latest.passed + latest.failed : 0;
  return {
    stats: {
      totalCases,
      executed,
      executedPct: pct(executed, totalCases),
      passed: latest?.passed ?? 0,
      passedPct: pct(latest?.passed ?? 0, executed),
      failed: latest?.failed ?? 0,
      failedPct: pct(latest?.failed ?? 0, executed),
      skipped: latest?.skipped ?? 0,
      bugs,
    },
    latestRun,
    summary: {
      passed: latest?.passed ?? 0,
      failed: latest?.failed ?? 0,
      skipped: latest?.skipped ?? 0,
    },
    recentRuns: runs.map((r) => ({
      id: r.id,
      runCode: r.runCode,
      projectName: r.project.name,
      startedAt: r.startedAt ?? r.createdAt,
      status: r.status,
      passed: r.passed,
      failed: r.failed,
      coverage: r.coverage,
    })),
  };
}

// ───────── quick API request (API Testing page) ─────────

export async function quickApiTest(projectId, user, body) {
  const project = await assertProjectAccess(projectId, user);
  const baseUrl = body.baseUrl || project.baseUrl || undefined;

  return aiEngine.executeApiCase({
    baseUrl,
    authToken: body.authToken,
    testData: {
      method: body.method,
      endpoint: body.endpoint,
      headers: body.headers,
      body: body.body,
      expected_status: body.expectedStatus,
    },
  });
}
