import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { tallyAll } from '../utils/stats.js';
import { aiEngine } from './aiEngine.client.js';
import { bugCode } from './bug.service.js';
import { assertProjectAccess } from './project.service.js';

const OPEN = ['OPEN', 'IN_PROGRESS'];
const FINISHED = ['COMPLETED', 'FAILED', 'CANCELLED'];
const HISTORY_TURNS = 8;
const KEEP_MESSAGES = 200;
const BUG_REF = /\bBUG-?0*(\d{1,6})\b/i;
const RUN_REF = /\bTR-\d{4}-\d{4}\b/i;

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
};
const day = (d) => (d ? d.toISOString().slice(0, 10) : 'n/a');
const publicMsg = ({ id, role, content, createdAt }) => ({ id, role, content, createdAt });

async function describeRun(run) {
  const results = await prisma.testResult.findMany({
    where: { runId: run.id },
    orderBy: { createdAt: 'asc' },
    select: { status: true, errorMessage: true, testCase: { select: { title: true, type: true } } },
  });
  const t = tallyAll(results);
  const lines = [
    `${run.runCode} (${run.status}, ${day(run.startedAt ?? run.createdAt)}, target ${run.targetUrl ?? 'n/a'}): ` +
      `${t.executed} executed, ${t.passed} passed, ${t.failed} failed, ${t.errors} error, ${t.skipped} skipped, ` +
      `pass rate ${t.passRate ?? 'n/a'}%, coverage ${run.coverage ?? 'n/a'}%`,
  ];
  if (run.errorMsg) lines.push(`  run message: ${clip(run.errorMsg, 160)}`);

  const bad = results
    .filter((r) => r.status === 'FAILED' || r.status === 'ERROR')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'FAILED' ? -1 : 1))
    .slice(0, 10);
  for (const r of bad) {
    lines.push(`  - ${r.status} [${r.testCase.type}] ${clip(r.testCase.title, 90)}: ${clip(r.errorMessage, 120)}`);
  }
  return lines.join('\n');
}

async function buildContext(project, question) {
  const pid = project.id;
  const [counts, byType, runs, openBugs, bugStats, readyReqs] = await Promise.all([
    prisma.project.findUnique({
      where: { id: pid },
      select: { _count: { select: { requirements: true, testCases: true, runs: true, bugs: true } } },
    }),
    prisma.testCase.groupBy({ by: ['type'], where: { projectId: pid }, _count: { _all: true } }),
    prisma.testRun.findMany({ where: { projectId: pid }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.bug.findMany({
      where: { projectId: pid, status: { in: OPEN } },
      orderBy: [{ severityScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 8,
      select: { number: true, title: true, severity: true, status: true, module: true },
    }),
    prisma.bug.groupBy({ by: ['status'], where: { projectId: pid }, _count: { _all: true } }),
    prisma.requirement.count({ where: { projectId: pid, status: 'READY' } }),
  ]);

  const c = counts._count;
  const lines = [
    `PROJECT: ${project.name} (platform ${project.platform}, base URL ${project.baseUrl ?? 'not set'})`,
    project.description ? `DESCRIPTION: ${clip(project.description, 300)}` : null,
    `TOTALS: ${c.testCases} test cases, ${c.runs} runs, ${c.bugs} bugs, ${c.requirements} requirements (${readyReqs} indexed)`,
    `TEST CASES BY TYPE: ${byType.map((g) => `${g.type} ${g._count._all}`).join(', ') || 'none'}`,
  ].filter(Boolean);

  const latest = runs.find((r) => FINISHED.includes(r.status));
  lines.push(latest ? `LATEST FINISHED RUN:\n${await describeRun(latest)}` : 'LATEST FINISHED RUN: none yet');

  if (runs.length) {
    lines.push(
      'RECENT RUNS (newest first; "failed" here includes Error results):\n' +
        runs
          .map(
            (r) =>
              `  ${r.runCode} ${r.status} ${day(r.startedAt ?? r.createdAt)}: ${r.passed} passed, ${r.failed} failed, ` +
              `${r.skipped} skipped, coverage ${r.coverage ?? 'n/a'}%`
          )
          .join('\n')
    );
  }

  const statusText = bugStats.map((g) => `${g.status} ${g._count._all}`).join(', ') || 'none';
  lines.push(
    `BUGS BY STATUS: ${statusText}\nTOP OPEN BUGS (severity is unreliable until a bug is analyzed):\n` +
      (openBugs.length
        ? openBugs
            .map((b) => `  - ${bugCode(b.number)} [${b.severity}] ${clip(b.title, 100)} (${b.module ?? 'no feature area'}, ${b.status})`)
            .join('\n')
        : '  none')
  );

  const bugMatch = question.match(BUG_REF);
  if (bugMatch) {
    const bug = await prisma.bug.findFirst({
      where: { projectId: pid, number: Number(bugMatch[1]) },
      include: {
        run: { select: { runCode: true } },
        testResult: { select: { errorMessage: true, testCase: { select: { title: true, expectedResult: true } } } },
      },
    });
    lines.push(
      bug
        ? [
            `REFERENCED BUG ${bugCode(bug.number)}: ${clip(bug.title, 150)}`,
            `  status ${bug.status}, severity ${bug.severity}, feature area ${bug.module ?? 'n/a'}, run ${bug.run?.runCode ?? 'n/a'}`,
            `  expected: ${clip(bug.testResult?.testCase?.expectedResult, 200)}`,
            `  failure: ${clip(bug.testResult?.errorMessage, 200)}`,
            `  AI explanation: ${clip(bug.aiExplanation, 600)}`,
            `  recommended fix: ${clip(bug.recommendedFix, 300)}`,
          ].join('\n')
        : `REFERENCED BUG: ${bugCode(Number(bugMatch[1]))} does not exist in this project.`
    );
  }

  const runMatch = question.match(RUN_REF);
  if (runMatch) {
    const code = runMatch[0].toUpperCase();
    const run = await prisma.testRun.findFirst({ where: { projectId: pid, runCode: code } });
    lines.push(run ? `REFERENCED RUN:\n${await describeRun(run)}` : `REFERENCED RUN: ${code} does not exist in this project.`);
  }

  return lines.join('\n').slice(0, 9000);
}

export async function listChat(projectId, user) {
  await assertProjectAccess(projectId, user);
  const rows = await prisma.chatMessage.findMany({
    where: { userId: user.id, projectId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return rows.reverse();
}

export async function askAssistant(projectId, user, message) {
  const project = await assertProjectAccess(projectId, user);

  const recent = await prisma.chatMessage.findMany({
    where: { userId: user.id, projectId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_TURNS,
    select: { role: true, content: true },
  });
  recent.reverse();

  const context = await buildContext(project, message);
  const res = await aiEngine.chat({
    projectId,
    message,
    context,
    history: recent.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: clip(m.content, 1500),
    })),
  });

  // Saved only after a successful answer, so the history never holds an unanswered question
  const now = Date.now();
  const [userMsg, botMsg] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { userId: user.id, projectId, role: 'USER', content: message, createdAt: new Date(now) },
    }),
    prisma.chatMessage.create({
      data: { userId: user.id, projectId, role: 'ASSISTANT', content: res.answer, createdAt: new Date(now + 1) },
    }),
  ]);

  // Keep the table small
  try {
    const old = await prisma.chatMessage.findMany({
      where: { userId: user.id, projectId },
      orderBy: { createdAt: 'desc' },
      skip: KEEP_MESSAGES,
      select: { id: true },
    });
    if (old.length) await prisma.chatMessage.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  } catch (e) {
    logger.warn(`Chat cleanup skipped: ${e.message}`);
  }

  return { messages: [publicMsg(userMsg), publicMsg(botMsg)], sources: res.sources ?? [] };
}

export async function clearChat(projectId, user) {
  await assertProjectAccess(projectId, user);
  await prisma.chatMessage.deleteMany({ where: { userId: user.id, projectId } });
}