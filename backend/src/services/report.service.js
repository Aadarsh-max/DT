import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { UPLOAD_DIR } from '../middleware/upload.middleware.js';
import { enqueueGenerateReport } from '../jobs/producers.js';
import { ApiError } from '../utils/ApiError.js';
import { rate, tallyBy, tallyAll } from '../utils/stats.js';
import { bugCode } from './bug.service.js';
import { assertProjectAccess } from './project.service.js';

export const REPORT_DIR = path.join(UPLOAD_DIR, 'reports');
const ACTIVE_RUN = ['QUEUED', 'RUNNING'];
const iso = (d) => (d ? d.toISOString() : null);
const safeName = (s) =>
  String(s).replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'report';

const publicReport = ({ filePath, ...r }) => ({ ...r, hasFile: !!filePath });

async function getOrThrow(id, user) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: { run: { select: { id: true, runCode: true } } },
  });
  if (!report) throw ApiError.notFound('Report not found');
  await assertProjectAccess(report.projectId, user);
  return report;
}

// ───────── create / read ─────────

export async function createReport(projectId, user, { runId, title }) {
  await assertProjectAccess(projectId, user);

  const run = runId
    ? await prisma.testRun.findFirst({ where: { id: runId, projectId } })
    : await prisma.testRun.findFirst({
        where: { projectId, status: { in: ['COMPLETED', 'CANCELLED'] } },
        orderBy: { createdAt: 'desc' },
      });
  if (!run) {
    throw ApiError.notFound(runId ? 'Test run not found in this project' : 'No finished test run yet. Run your tests first.');
  }
  if (ACTIVE_RUN.includes(run.status)) throw ApiError.conflict('Wait for the run to finish before creating a report');

  const results = await prisma.testResult.count({ where: { runId: run.id } });
  if (results === 0) throw ApiError.badRequest('This run has no results to report on');

  const busy = await prisma.report.findFirst({
    where: { runId: run.id, status: 'GENERATING' },
    select: { id: true },
  });
  if (busy) throw ApiError.conflict('A report for this run is already being generated');

  const report = await prisma.report.create({
    data: { projectId, runId: run.id, title: title || `${run.runCode} test report`, status: 'GENERATING' },
  });

  try {
    await enqueueGenerateReport({ reportId: report.id });
  } catch (e) {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: 'FAILED', errorMsg: 'Could not queue the report. Is Redis running?' },
    });
    throw e;
  }
  return publicReport(report);
}

export async function listReports(projectId, user, q) {
  await assertProjectAccess(projectId, user);
  const where = { projectId, ...(q.runId && { runId: q.runId }) };
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        projectId: true,
        runId: true,
        title: true,
        summary: true,
        status: true,
        errorMsg: true,
        filePath: true,
        createdAt: true,
        run: { select: { runCode: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);
  const items = rows.map(({ run, ...r }) => ({ ...publicReport(r), runCode: run?.runCode ?? null }));
  return { items, total, page: q.page, limit: q.limit };
}

export async function getReport(id, user) {
  return publicReport(await getOrThrow(id, user));
}

export async function getReportFile(id, user) {
  const report = await getOrThrow(id, user);
  if (report.status !== 'READY' || !report.filePath) throw ApiError.notFound('This report has no PDF yet');

  const root = path.resolve(REPORT_DIR);
  const abs = path.resolve(root, report.filePath);
  if (!abs.startsWith(root + path.sep)) throw ApiError.notFound('Invalid file path');
  await fs.access(abs).catch(() => {
    throw ApiError.notFound('The PDF file is missing');
  });
  return { abs, filename: `${safeName(report.title)}.pdf` };
}

export async function deleteReport(id, user) {
  const report = await getOrThrow(id, user);
  if (report.status === 'GENERATING') throw ApiError.conflict('Wait until the report has finished generating');
  await prisma.report.delete({ where: { id } });
  if (report.filePath) {
    await fs.rm(path.join(REPORT_DIR, report.filePath), { force: true }).catch(() => {});
  }
}

// ───────── used by the worker ─────────

// Every number in a report comes from here (the database), never from the AI
export async function collectReportFacts(report) {
  const run = await prisma.testRun.findUnique({
    where: { id: report.runId },
    include: {
      project: { select: { name: true, platform: true, baseUrl: true } },
      triggeredBy: { select: { name: true } },
    },
  });
  if (!run) throw new Error('The test run for this report was deleted');

  const [results, bugs, prev] = await Promise.all([
    prisma.testResult.findMany({
      where: { runId: run.id },
      orderBy: { createdAt: 'asc' },
      select: {
        status: true,
        errorMessage: true,
        testCase: { select: { title: true, type: true, module: true } },
      },
    }),
    prisma.bug.findMany({
      where: { runId: run.id },
      orderBy: [{ severityScore: { sort: 'desc', nulls: 'last' } }, { number: 'asc' }],
      select: { number: true, title: true, severity: true, status: true, module: true },
    }),
    prisma.testRun.findFirst({
      where: { projectId: run.projectId, id: { not: run.id }, createdAt: { lt: run.createdAt }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const all = tallyAll(results);
  const bySeverity = {};
  for (const b of bugs) bySeverity[b.severity] = (bySeverity[b.severity] ?? 0) + 1;

  const failures = results
    .filter((r) => r.status === 'FAILED' || r.status === 'ERROR')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'FAILED' ? -1 : 1))
    .slice(0, 12)
    .map((r) => ({
      title: r.testCase.title,
      type: r.testCase.type,
      module: r.testCase.module,
      status: r.status,
      message: (r.errorMessage ?? '').slice(0, 200),
    }));

  const finishedMs = run.finishedAt && run.startedAt ? run.finishedAt - run.startedAt : null;

  return {
    project: { name: run.project.name, platform: run.project.platform, baseUrl: run.project.baseUrl },
    run: {
      code: run.runCode,
      status: run.status,
      startedAt: iso(run.startedAt ?? run.createdAt),
      finishedAt: iso(run.finishedAt),
      durationSec: finishedMs != null ? Math.round(finishedMs / 1000) : null,
      targetUrl: run.targetUrl,
      triggeredBy: run.triggeredBy?.name ?? null,
      total: run.total,
      executed: all.executed,
      passed: all.passed,
      failed: all.failed,
      errors: all.errors,
      skipped: all.skipped,
      passRate: all.passRate,
      coverage: run.coverage,
    },
    previous: prev ? { code: prev.runCode, passRate: rate(prev.passed, prev.passed + prev.failed) } : null,
    byType: tallyBy(results, (r) => r.testCase.type),
    byModule: tallyBy(results, (r) => r.testCase.module || 'General'),
    bugs: {
      total: bugs.length,
      bySeverity,
      items: bugs.slice(0, 10).map((b) => ({
        code: bugCode(b.number),
        title: b.title,
        severity: b.severity,
        status: b.status,
        module: b.module,
      })),
    },
    failures,
    generatedAt: new Date().toISOString(),
  };
}