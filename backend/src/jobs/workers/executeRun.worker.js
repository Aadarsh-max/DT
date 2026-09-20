import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'bullmq';
import { prisma } from '../../config/db.js';
import { QUEUE_NAMES } from '../../config/queue.js';
import { redis } from '../../config/redis.js';
import { notifyRunFinished } from '../../services/alerts.service.js';
import { aiEngine } from '../../services/aiEngine.client.js';
import { createBugsForRun } from '../../services/bug.service.js';
import { SCREENSHOT_DIR, isApiCase } from '../../services/run.service.js';
import { logger } from '../../utils/logger.js';
import { enqueueAnalyzeBugs } from '../producers.js';

const round1 = (n) => Math.round(n * 10) / 10;

async function runCase(tc, ctx) {
  const t0 = Date.now();
  try {
    if (ctx.mobile) {
      return await aiEngine.executeMobileCase({ runId: ctx.runId, testCase: tc, target: ctx.mobile });
    }
    if (isApiCase(tc)) {
      return await aiEngine.executeApiCase({
        baseUrl: ctx.apiBase,
        testData: tc.testData,
        authToken: ctx.authToken,
      });
    }
    return await aiEngine.executeUiCase({
      runId: ctx.runId,
      testCase: tc,
      baseUrl: ctx.uiUrl,
      headless: ctx.headless,
    });
  } catch (e) {
    return {
      status: 'ERROR',
      durationMs: Date.now() - t0,
      errorMessage: e.message,
      logs: [`\u2717 ${e.message}`],
      screenshotB64: null,
      response: null,
    };
  }
}

async function saveResult(run, tc, out) {
  const id = randomUUID();
  let screenshotPath = null;

  if (out.screenshotB64) {
    const rel = path.join(run.projectId, run.id, `${id}.png`);
    const abs = path.join(SCREENSHOT_DIR, rel);
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, Buffer.from(out.screenshotB64, 'base64'));
      screenshotPath = rel.split(path.sep).join('/');
    } catch (e) {
      logger.warn(`Could not save screenshot: ${e.message}`);
    }
  }

  await prisma.testResult.create({
    data: {
      id,
      runId: run.id,
      testCaseId: tc.id,
      status: out.status,
      durationMs: out.durationMs ?? 0,
      errorMessage: out.errorMessage ? String(out.errorMessage).slice(0, 2000) : null,
      logs: (out.logs ?? []).join('\n').slice(0, 20000),
      screenshotPath,
      response: out.response ?? undefined,
    },
  });
}

async function checkTarget(url, needBrowser) {
  const res = await aiEngine.preflight({ url, needBrowser });
  if (!res.ok) throw new Error(res.error || `Cannot reach ${url}`);
}

async function checkMobile(mobile) {
  const res = await aiEngine.mobilePreflight(mobile);
  if (!res.ok) throw new Error(res.error || 'The Android device or Appium is not ready');
}

async function processor(job) {
  const { runId, caseIds, uiUrl, apiBase, headless, authToken, mobile } = job.data;

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  // Deleted, cancelled while queued, or already handled (BullMQ can re-deliver a stalled job)
  if (!run || run.status !== 'QUEUED') return { skipped: true };

  try {
    await prisma.testRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', stage: 'preparing', startedAt: new Date() },
    });
    await job.updateProgress({
      message: mobile ? 'Checking Appium and the device' : 'Checking that the target is reachable',
      current: 0,
    });

    const found = await prisma.testCase.findMany({ where: { id: { in: caseIds } } });
    const byId = new Map(found.map((c) => [c.id, c]));
    const cases = caseIds.map((id) => byId.get(id)).filter(Boolean); // keeps the ranked order
    if (cases.length === 0) throw new Error('The selected test cases no longer exist');

    // Fail fast with a clear message instead of erroring on every case
    if (mobile) {
      await checkMobile(mobile);
    } else {
      if (cases.some((c) => !isApiCase(c))) await checkTarget(uiUrl, true);
      if (cases.some(isApiCase) && apiBase !== uiUrl) await checkTarget(apiBase, false);
    }

    const ctx = { runId, uiUrl, apiBase, headless: headless !== false, authToken, mobile };
    const total = cases.length;

    for (let i = 0; i < total; i++) {
      const { status } = await prisma.testRun.findUnique({ where: { id: runId }, select: { status: true } });
      if (status === 'CANCELLED') break;

      const tc = cases[i];
      await job.updateProgress({ message: `Running: ${tc.title}`, current: i + 1 });

      const out = await runCase(tc, ctx);
      await saveResult(run, tc, out);

      const field = out.status === 'PASSED' ? 'passed' : out.status === 'SKIPPED' ? 'skipped' : 'failed';
      await prisma.testRun.update({
        where: { id: runId },
        data: {
          [field]: { increment: 1 },
          stage: 'test_execution',
          progress: Math.min(99, Math.round(((i + 1) / total) * 100)),
        },
      });
    }

    // Coverage = executed cases / all cases in the project (mobile runs count MOBILE cases only)
    const [fresh, projectCases] = await Promise.all([
      prisma.testRun.findUnique({ where: { id: runId } }),
      prisma.testCase.count({
        where: { projectId: run.projectId, ...(mobile ? { type: 'MOBILE' } : { NOT: { type: 'MOBILE' } }) },
      }),
    ]);
    const executed = fresh.passed + fresh.failed;
    const coverage = projectCases ? round1((executed / projectCases) * 100) : null;

    await prisma.testRun.update({ where: { id: runId }, data: { coverage } });
    // Only a still-running run becomes COMPLETED, so a cancel is never overwritten
    const completed = await prisma.testRun.updateMany({
      where: { id: runId, status: 'RUNNING' },
      data: { status: 'COMPLETED', stage: 'done', progress: 100, finishedAt: new Date() },
    });

    // Failed tests become bug reports, and the AI analysis is queued
    if (completed.count) {
      try {
        const bugIds = await createBugsForRun(runId);
        if (bugIds.length) {
          await enqueueAnalyzeBugs(bugIds);
          logger.info(`Run ${run.runCode}: ${bugIds.length} bug(s) queued for analysis`);
        }
      } catch (e) {
        logger.warn(`Could not create bugs for run ${run.runCode}: ${e.message}`);
      }

      // In-app, Slack and email alert when the run has failures
      await notifyRunFinished(runId);
    }

    return { passed: fresh.passed, failed: fresh.failed, skipped: fresh.skipped };
  } catch (e) {
    await prisma.testRun.updateMany({
      where: { id: runId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'FAILED', errorMsg: String(e.message).slice(0, 500), finishedAt: new Date() },
    });
    await notifyRunFinished(runId);
    throw e;
  } finally {
    aiEngine.clearScreenshots(runId).catch(() => {});
  }
}

export function startExecuteRunWorker() {
  const worker = new Worker(QUEUE_NAMES.EXECUTE_RUN, processor, {
    connection: redis,
    concurrency: 1, // one browser or device test at a time keeps RAM predictable
    lockDuration: 15 * 60 * 1000, // a single case can take minutes on a laptop
  });

  worker.on('completed', (job, result) => {
    if (!result?.skipped) logger.info(`Run ${job.id} finished`);
  });
  worker.on('failed', (job, err) => logger.error(`Run ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => logger.error(`Execute worker error: ${err.message}`));

  logger.info('Execute-run worker started');
  return worker;
}