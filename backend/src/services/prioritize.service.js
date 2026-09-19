import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { aiEngine } from './aiEngine.client.js';

const OPEN = ['OPEN', 'IN_PROGRESS'];
const HISTORY_RUNS = 30;

// cases: [{ id, type, priority, module }], already in the fallback (priority) order.
// Never throws: if ranking fails, the incoming order is kept.
export async function rankTestCases(projectId, cases) {
  const fallback = { ordered: cases, method: 'priority', samples: 0 };
  if (cases.length < 2) return fallback;

  try {
    const ids = cases.map((c) => c.id);
    const runs = await prisma.testRun.findMany({
      where: { projectId, status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_RUNS,
      select: { id: true },
    });

    const [results, bugs] = await Promise.all([
      runs.length
        ? prisma.testResult.findMany({
            where: { runId: { in: runs.map((r) => r.id) }, testCaseId: { in: ids } },
            orderBy: { createdAt: 'asc' },
            select: { testCaseId: true, status: true },
          })
        : [],
      prisma.bug.findMany({
        where: {
          projectId,
          status: { in: OPEN },
          testResult: { is: { testCaseId: { in: ids } } },
        },
        select: { testResult: { select: { testCaseId: true } } },
      }),
    ]);

    const history = new Map();
    for (const r of results) {
      if (!history.has(r.testCaseId)) history.set(r.testCaseId, []);
      history.get(r.testCaseId).push(r.status);
    }
    const withBug = new Set(bugs.map((b) => b.testResult?.testCaseId).filter(Boolean));

    const data = await aiEngine.rankCases({
      projectId,
      cases: cases.map((c) => ({
        id: c.id,
        type: c.type,
        priority: c.priority,
        module: c.module ?? null,
        open_bug: withBug.has(c.id),
        history: history.get(c.id) ?? [],
      })),
    });

    const byId = new Map(cases.map((c) => [c.id, c]));
    const ordered = data.ranked.map((r) => byId.get(r.id)).filter(Boolean);
    const seen = new Set(ordered.map((c) => c.id));
    for (const c of cases) if (!seen.has(c.id)) ordered.push(c);

    // Keep the score so the Test Cases page can show it (not critical if this fails)
    await prisma
      .$transaction(
        data.ranked.map((r) =>
          prisma.testCase.update({ where: { id: r.id }, data: { priorityScore: r.score } })
        )
      )
      .catch((e) => logger.warn(`Could not save priority scores: ${e.message}`));

    return { ordered, method: data.method, samples: data.samples };
  } catch (e) {
    logger.warn(`Smart ordering skipped, using priority order: ${e.message}`);
    return fallback;
  }
}