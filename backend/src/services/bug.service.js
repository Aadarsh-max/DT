import { prisma } from '../config/db.js';
import {
  clearBugJobError,
  enqueueAnalyzeBugs,
  enqueueFixBug,
  findActiveBugJob,
  getBugJobError,
} from '../jobs/producers.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { aiEngine } from './aiEngine.client.js';
import { assertProjectAccess } from './project.service.js';
import { notifyUsers, projectPeople } from './notification.service.js';

export const bugCode = (n) => `BUG-${String(n).padStart(4, '0')}`;
const withCode = (b) => ({ ...b, code: bugCode(b.number) });
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'];
const round1 = (n) => Math.round(n * 10) / 10;

const describe = (r) =>
  [
    r.testCase.expectedResult && `Expected: ${r.testCase.expectedResult}`,
    r.errorMessage && `Actual: ${r.errorMessage}`,
  ]
    .filter(Boolean)
    .join('\n') || null;

const duplicateText = (title, module, error) =>
  [title, module, error].filter(Boolean).join('. ').slice(0, 600);

// ───────── creating bugs ─────────

// Only FAILED results become bugs. ERROR means the test could not run, which proves nothing about the app.
export async function createBugsForRun(runId) {
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { id: true, projectId: true },
  });
  if (!run) return [];

  const failed = await prisma.testResult.findMany({
    where: { runId, status: 'FAILED', bug: { is: null } },
    orderBy: { createdAt: 'asc' },
    include: { testCase: { select: { title: true, module: true, expectedResult: true } } },
  });

  const ids = [];
  for (const r of failed) {
    try {
      const bug = await prisma.bug.create({
        data: {
          projectId: run.projectId,
          runId,
          testResultId: r.id,
          title: r.testCase.title.slice(0, 200),
          description: describe(r),
          module: r.testCase.module,
          status: 'OPEN',
        },
      });
      ids.push(bug.id);
    } catch (e) {
      if (e?.code !== 'P2002') throw e; // already has a bug
    }
  }
  return ids;
}

export async function syncProjectBugs(projectId, user) {
  await assertProjectAccess(projectId, user);
  const runs = await prisma.testRun.findMany({
    where: { projectId, status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] } },
    orderBy: { createdAt: 'asc' }, // oldest first, so bug numbers follow the timeline
    select: { id: true },
  });

  const ids = [];
  for (const r of runs) ids.push(...(await createBugsForRun(r.id)));
  await enqueueAnalyzeBugs(ids);
  return { created: ids.length };
}

// ───────── reading ─────────

export async function listBugs(projectId, user, q) {
  await assertProjectAccess(projectId, user);

  const where = {
    projectId,
    ...(q.status && { status: q.status }),
    ...(q.severity && { severity: q.severity }),
  };
  if (q.search) {
    const m = q.search.match(/^(?:bug-?)?0*(\d{1,9})$/i);
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
      ...(m ? [{ number: Number(m[1]) }] : []),
    ];
  }

  const [rows, total, bySeverity, byStatus] = await Promise.all([
    prisma.bug.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        number: true,
        title: true,
        module: true,
        severity: true,
        severityScore: true,
        status: true,
        confidence: true,
        duplicateOfId: true,
        createdAt: true,
        aiExplanation: true,
        run: { select: { runCode: true } },
      },
    }),
    prisma.bug.count({ where }),
    prisma.bug.groupBy({ by: ['severity'], where: { projectId }, _count: { _all: true } }),
    prisma.bug.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
  ]);

  const items = rows.map(({ aiExplanation, run, ...b }) => ({
    ...withCode(b),
    analyzed: !!aiExplanation,
    runCode: run?.runCode ?? null,
    possibleDuplicate: !!b.duplicateOfId && b.status !== 'DUPLICATE',
  }));

  const byStatusMap = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]));
  return {
    items,
    total,
    page: q.page,
    limit: q.limit,
    stats: {
      total: byStatus.reduce((sum, g) => sum + g._count._all, 0),
      bySeverity: Object.fromEntries(bySeverity.map((g) => [g.severity, g._count._all])),
      byStatus: byStatusMap,
    },
  };
}

async function loadBug(id, user) {
  const bug = await prisma.bug.findUnique({
    where: { id },
    include: {
      run: { select: { id: true, runCode: true } },
      duplicateOf: { select: { id: true, number: true, title: true, status: true } },
      testResult: { include: { testCase: true } },
    },
  });
  if (!bug) throw ApiError.notFound('Bug not found');
  await assertProjectAccess(bug.projectId, user);
  return bug;
}

export async function getBug(id, user) {
  const bug = await loadBug(id, user);
  const [activeJob, jobError, codeCount] = await Promise.all([
    findActiveBugJob(id),
    getBugJobError(id),
    prisma.requirement.count({ where: { projectId: bug.projectId, type: 'CODE', status: 'READY' } }),
  ]);

  const { testResult, duplicateOf, ...rest } = bug;
  return {
    ...withCode(rest),
    duplicateOf: duplicateOf ? { ...duplicateOf, code: bugCode(duplicateOf.number) } : null,
    testCase: testResult?.testCase ?? null,
    result: testResult
      ? {
          id: testResult.id,
          status: testResult.status,
          durationMs: testResult.durationMs,
          errorMessage: testResult.errorMessage,
          logs: testResult.logs,
          screenshotPath: testResult.screenshotPath,
          response: testResult.response,
        }
      : null,
    activeJob,
    jobError: activeJob ? null : jobError,
    hasCode: codeCount > 0,
  };
}

export async function featuredBug(projectId, user) {
  await assertProjectAccess(projectId, user);
  const bug = await prisma.bug.findFirst({
    where: { projectId, status: { in: OPEN_STATUSES }, aiExplanation: { not: null } },
    orderBy: [{ severityScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: { testResult: { select: { id: true, screenshotPath: true } } },
  });
  if (!bug) return null;
  return {
    id: bug.id,
    code: bugCode(bug.number),
    title: bug.title,
    severity: bug.severity,
    explanation: bug.aiExplanation,
    recommendedFix: bug.recommendedFix,
    confidence: bug.confidence,
    testResultId: bug.testResult?.id ?? null,
    hasScreenshot: !!bug.testResult?.screenshotPath,
  };
}

export async function bugInsights(projectId, user) {
  await assertProjectAccess(projectId, user);

  const [total, pending, avg, bySeverity, byStatus, byModule, possible, confirmed, top, engine] =
    await Promise.all([
      prisma.bug.count({ where: { projectId } }),
      prisma.bug.count({ where: { projectId, aiExplanation: null } }),
      prisma.bug.aggregate({ where: { projectId, confidence: { not: null } }, _avg: { confidence: true } }),
      prisma.bug.groupBy({ by: ['severity'], where: { projectId }, _count: { _all: true } }),
      prisma.bug.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
      prisma.bug.groupBy({
        by: ['module'],
        where: { projectId, module: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { module: 'desc' } },
        take: 6,
      }),
      prisma.bug.count({ where: { projectId, duplicateOfId: { not: null }, status: { not: 'DUPLICATE' } } }),
      prisma.bug.count({ where: { projectId, status: 'DUPLICATE' } }),
      prisma.bug.findMany({
        where: { projectId, status: { in: OPEN_STATUSES } },
        orderBy: [{ severityScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: 5,
        select: { id: true, number: true, title: true, severity: true, severityScore: true, module: true, status: true },
      }),
      aiEngine.bugEngineStatus().catch(() => null),
    ]);

  return {
    total,
    analyzed: total - pending,
    pending,
    avgConfidence: avg._avg.confidence != null ? round1(avg._avg.confidence) : null,
    bySeverity: Object.fromEntries(bySeverity.map((g) => [g.severity, g._count._all])),
    byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    byModule: byModule.map((g) => ({ module: g.module, count: g._count._all })),
    duplicates: { possible, confirmed },
    topRisk: top.map((b) => ({ ...withCode(b) })),
    engine,
  };
}

// ───────── editing ─────────

export async function updateBug(id, user, data) {
  await loadBug(id, user);
  await prisma.bug.update({ where: { id }, data });
  return getBug(id, user);
}

export async function deleteBug(id, user) {
  const bug = await loadBug(id, user);
  await prisma.bug.delete({ where: { id } });
  aiEngine.removeBugVector(bug.projectId, id).catch(() => {});
}

export async function confirmDuplicate(id, user) {
  const bug = await loadBug(id, user);
  if (!bug.duplicateOfId) throw ApiError.badRequest('No duplicate was detected for this bug');
  await prisma.bug.update({ where: { id }, data: { status: 'DUPLICATE' } });
  return getBug(id, user);
}

export async function dismissDuplicate(id, user) {
  const bug = await loadBug(id, user);
  await prisma.bug.update({
    where: { id },
    data: {
      duplicateOfId: null,
      duplicateScore: null,
      ...(bug.status === 'DUPLICATE' && { status: 'OPEN' }),
    },
  });
  return getBug(id, user);
}

// ───────── starting AI jobs ─────────

export async function startAnalyze(id, user) {
  await loadBug(id, user);
  if (await findActiveBugJob(id)) throw ApiError.conflict('This bug is already being processed');
  await clearBugJobError(id);
  await enqueueAnalyzeBugs([id]);
}

export async function startFix(id, user) {
  const bug = await loadBug(id, user);
  const code = await prisma.requirement.count({
    where: { projectId: bug.projectId, type: 'CODE', status: 'READY' },
  });
  if (code === 0) {
    throw ApiError.badRequest(
      'No source code is indexed. Upload your code as a requirement of type "Source code" on the project page.'
    );
  }
  if (await findActiveBugJob(id)) throw ApiError.conflict('This bug is already being processed');
  await clearBugJobError(id);
  await enqueueFixBug(id);
}

// ───────── work done by the workers ─────────

export async function analyzeBug(bugId) {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    include: { testResult: { include: { testCase: true } } },
  });
  if (!bug) return { warnings: [] };

  const result = bug.testResult;
  const tc = result?.testCase;
  const firstTime = !bug.aiExplanation;

  const ai = await aiEngine.analyzeBug({
    projectId: bug.projectId,
    title: bug.title,
    module: bug.module,
    testType: tc?.type ?? 'FUNCTIONAL',
    priority: tc?.priority ?? 'MEDIUM',
    resultStatus: result?.status ?? 'FAILED',
    steps: Array.isArray(tc?.steps) ? tc.steps : [],
    expectedResult: tc?.expectedResult,
    errorMessage: result?.errorMessage,
    logs: result?.logs,
    response: result?.response,
  });

  const warnings = [...(ai.warnings ?? [])];
  const data = { severity: ai.severity, severityScore: ai.severity_score };
  if (ai.explanation) data.aiExplanation = ai.explanation;
  if (ai.recommended_fix) data.recommendedFix = ai.recommended_fix;
  if (ai.confidence != null) data.confidence = ai.confidence; // percent, 20 to 95
  if (firstTime && ai.explanation && ai.title) data.title = ai.title.slice(0, 200);

  // Duplicate check uses the test case title (stable across runs), not the AI-written bug title
  try {
    const text = duplicateText(tc?.title ?? bug.title, bug.module, result?.errorMessage);
    const dup = await aiEngine.checkDuplicates({ projectId: bug.projectId, bugId, text });
    const hits = (dup.matches ?? []).filter((m) => m.score >= dup.threshold);

    if (hits.length) {
      const older = await prisma.bug.findMany({
        where: {
          id: { in: hits.map((h) => h.bug_id) },
          projectId: bug.projectId,
          number: { lt: bug.number },
        },
        select: { id: true, status: true, duplicateOfId: true },
      });
      const byId = new Map(older.map((o) => [o.id, o]));
      const best = hits.find((h) => byId.has(h.bug_id));
      if (best) {
        const original = byId.get(best.bug_id);
        data.duplicateOfId =
          original.status === 'DUPLICATE' && original.duplicateOfId ? original.duplicateOfId : original.id;
        data.duplicateScore = best.score;
      }
    }
  } catch (e) {
    warnings.push(`Duplicate check skipped: ${e.message}`);
  }

  await prisma.bug.update({ where: { id: bugId }, data });
  return { warnings };
}

export async function generateFix(bugId) {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    include: { testResult: { select: { errorMessage: true } } },
  });
  if (!bug) return;

  const code = await prisma.requirement.findMany({
    where: { projectId: bug.projectId, type: 'CODE', status: 'READY' },
    select: { id: true },
  });
  if (code.length === 0) throw new Error('No source code is indexed for this project.');

  const res = await aiEngine.suggestFix({
    projectId: bug.projectId,
    title: bug.title,
    module: bug.module,
    errorMessage: bug.testResult?.errorMessage,
    explanation: bug.aiExplanation,
    requirementIds: code.map((c) => c.id),
  });

  await prisma.bug.update({ where: { id: bugId }, data: { fixPatch: res.patch } });
  logger.info(`Fix suggested for ${bugCode(bug.number)} (${res.files.join(', ')})`);
}