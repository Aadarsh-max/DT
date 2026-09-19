import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { rate, tallyAll } from '../utils/stats.js';
import { aiEngine } from './aiEngine.client.js';
import { assertProjectAccess } from './project.service.js';

const ACTIVE = ['QUEUED', 'RUNNING'];
const OPEN = ['OPEN', 'IN_PROGRESS'];

export async function getRunRisk(id, user) {
  const run = await prisma.testRun.findUnique({ where: { id } });
  if (!run) throw ApiError.notFound('Test run not found');
  await assertProjectAccess(run.projectId, user);
  if (ACTIVE.includes(run.status)) throw ApiError.conflict('Wait for the run to finish');

  const [results, bugGroups, prev, runsAnalysed] = await Promise.all([
    prisma.testResult.findMany({ where: { runId: id }, select: { status: true } }),
    prisma.bug.groupBy({
      by: ['severity'],
      where: { projectId: run.projectId, status: { in: OPEN } },
      _count: { _all: true },
    }),
    prisma.testRun.findFirst({
      where: { projectId: run.projectId, id: { not: id }, createdAt: { lt: run.createdAt }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.testRun.count({
      where: {
        projectId: run.projectId,
        status: { in: ['COMPLETED', 'CANCELLED'] },
        createdAt: { lte: run.createdAt },
      },
    }),
  ]);

  const all = tallyAll(results);
  const facts = {
    executed: all.executed,
    passed: all.passed,
    failed: all.failed,
    errors: all.errors,
    skipped: all.skipped,
    passRate: all.passRate,
    coverage: run.coverage,
    previousPassRate: prev ? rate(prev.passed, prev.passed + prev.failed) : null,
    openBugs: Object.fromEntries(bugGroups.map((g) => [g.severity, g._count._all])),
    runsAnalysed,
  };

  const risk = await aiEngine.estimateRisk(facts);

  if (risk.probability != null) {
    await prisma.testRun
      .update({ where: { id }, data: { deployRisk: risk.probability } })
      .catch(() => {});
  }
  return { runId: run.id, runCode: run.runCode, ...risk };
}