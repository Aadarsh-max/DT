import { prisma } from '../config/db.js';
import { rate, round1, tallyBy } from '../utils/stats.js';
import { assertProjectAccess } from './project.service.js';

const MAX_RUNS = 30;
const OPEN = ['OPEN', 'IN_PROGRESS'];

export async function projectAnalytics(projectId, user, { days } = {}) {
  await assertProjectAccess(projectId, user);
  const since = days ? new Date(Date.now() - days * 86400000) : null;

  const newest = await prisma.testRun.findMany({
    where: {
      projectId,
      status: { in: ['COMPLETED', 'CANCELLED'] },
      ...(since && { createdAt: { gte: since } }),
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_RUNS,
  });
  const runs = newest.reverse(); // oldest first, for the trend chart
  const ids = runs.map((r) => r.id);

  const bugWhere = { projectId, ...(since && { createdAt: { gte: since } }) };
  const [results, bySeverity, unanalyzed, totalBugs, openBugs] = await Promise.all([
    ids.length
      ? prisma.testResult.findMany({
          where: { runId: { in: ids } },
          select: {
            status: true,
            testCaseId: true,
            testCase: { select: { title: true, type: true, module: true } },
          },
        })
      : [],
    // Unanalyzed bugs still carry the default severity, so they are counted separately
    prisma.bug.groupBy({ by: ['severity'], where: { ...bugWhere, aiExplanation: { not: null } }, _count: { _all: true } }),
    prisma.bug.count({ where: { ...bugWhere, aiExplanation: null } }),
    prisma.bug.count({ where: bugWhere }),
    prisma.bug.count({ where: { projectId, status: { in: OPEN } } }),
  ]);

  const trend = runs.map((r) => ({
    runId: r.id,
    runCode: r.runCode,
    date: r.startedAt ?? r.createdAt,
    passed: r.passed,
    failed: r.failed,
    skipped: r.skipped,
    total: r.total,
    passRate: rate(r.passed, r.passed + r.failed),
  }));

  const sumPassed = runs.reduce((s, r) => s + r.passed, 0);
  const sumExecuted = runs.reduce((s, r) => s + r.passed + r.failed, 0);
  const rated = trend.filter((p) => p.passRate != null);
  const latest = rated.at(-1)?.passRate ?? null;
  const previous = rated.length > 1 ? rated.at(-2).passRate : null;

  const timed = runs.filter((r) => r.startedAt && r.finishedAt);
  const avgDurationSec = timed.length
    ? Math.round(timed.reduce((s, r) => s + (r.finishedAt - r.startedAt), 0) / timed.length / 1000)
    : null;

  const perCase = new Map();
  for (const r of results) {
    const e = perCase.get(r.testCaseId) ?? { title: r.testCase.title, type: r.testCase.type, runs: 0, failures: 0 };
    e.runs += 1;
    if (r.status === 'FAILED' || r.status === 'ERROR') e.failures += 1;
    perCase.set(r.testCaseId, e);
  }
  const topFailing = [...perCase.values()]
    .filter((e) => e.failures > 0)
    .sort((a, b) => b.failures - a.failures || b.failures / b.runs - a.failures / a.runs)
    .slice(0, 5);

  return {
    range: { days: days ?? null, runs: runs.length, maxRuns: MAX_RUNS },
    kpis: {
      runs: runs.length,
      avgPassRate: rate(sumPassed, sumExecuted),
      latestPassRate: latest,
      previousPassRate: previous,
      delta: latest != null && previous != null ? round1(latest - previous) : null,
      totalBugs,
      openBugs,
      avgDurationSec,
    },
    trend,
    bugs: {
      bySeverity: Object.fromEntries(bySeverity.map((g) => [g.severity, g._count._all])),
      unanalyzed,
    },
    byType: tallyBy(results, (r) => r.testCase.type),
    byModule: tallyBy(results, (r) => r.testCase.module || 'General').slice(0, 8),
    topFailing,
  };
}