import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { queues } from '../config/queue.js';
import { ApiError } from '../utils/ApiError.js';
import { enqueueGenerateTests, findActiveGeneration } from '../jobs/producers.js';
import { assertProjectAccess } from './project.service.js';

const norm = (s) => String(s).trim().toLowerCase();

// ───────── CRUD ─────────

export async function listTestCases(projectId, user, q) {
  await assertProjectAccess(projectId, user);

  const where = {
    projectId,
    ...(q.type && { type: q.type }),
    ...(q.priority && { priority: q.priority }),
    ...(q.module && { module: q.module }),
    ...(q.search && {
      OR: [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total, groups, moduleRows] = await Promise.all([
    prisma.testCase.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { title: 'asc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.testCase.count({ where }),
    prisma.testCase.groupBy({ by: ['type'], where: { projectId }, _count: { _all: true } }),
    prisma.testCase.findMany({
      where: { projectId, module: { not: null } },
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    }),
  ]);

  const byType = Object.fromEntries(groups.map((g) => [g.type, g._count._all]));
  const overall = groups.reduce((sum, g) => sum + g._count._all, 0);

  return {
    items,
    total,
    page: q.page,
    limit: q.limit,
    stats: { total: overall, byType },
    modules: moduleRows.map((m) => m.module),
  };
}

async function getOrThrow(id, user) {
  const testCase = await prisma.testCase.findUnique({ where: { id } });
  if (!testCase) throw ApiError.notFound('Test case not found');
  await assertProjectAccess(testCase.projectId, user);
  return testCase;
}

export const getTestCase = (id, user) => getOrThrow(id, user);

export async function updateTestCase(id, user, data) {
  await getOrThrow(id, user);
  const { testData, ...rest } = data;
  const patch = { ...rest };
  if (testData !== undefined) patch.testData = testData === null ? Prisma.JsonNull : testData;
  return prisma.testCase.update({ where: { id }, data: patch });
}

export async function deleteTestCase(id, user) {
  await getOrThrow(id, user);
  await prisma.testCase.delete({ where: { id } });
}

export async function bulkDeleteTestCases(projectId, user, ids) {
  await assertProjectAccess(projectId, user);
  const res = await prisma.testCase.deleteMany({ where: { id: { in: ids }, projectId } });
  return { deleted: res.count };
}

// ───────── Used by the generation worker ─────────

export async function recentTitles(projectId, type, take = 25) {
  const rows = await prisma.testCase.findMany({
    where: { projectId, type },
    orderBy: { createdAt: 'desc' },
    take,
    select: { title: true },
  });
  return rows.map((r) => r.title);
}

export async function saveGeneratedTestCases({ project, type, requirementId, cases }) {
  const existing = await prisma.testCase.findMany({
    where: { projectId: project.id, type },
    select: { title: true },
  });
  const seen = new Set(existing.map((t) => norm(t.title)));

  const platform = type === 'API' ? 'API' : project.platform;
  const rows = [];
  for (const c of cases) {
    const key = norm(c.title);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      projectId: project.id,
      requirementId: requirementId ?? null,
      title: c.title,
      description: c.description ?? null,
      module: c.module ?? null,
      type,
      platform,
      priority: c.priority ?? 'MEDIUM',
      preconditions: c.preconditions ?? null,
      steps: c.steps ?? [],
      expectedResult: c.expected_result ?? null,
      testData: c.test_data ?? undefined,
      generatedByAI: true,
    });
  }
  if (rows.length === 0) return 0;

  const res = await prisma.testCase.createMany({ data: rows });
  return res.count;
}

// ───────── Generation jobs ─────────

const STATE_MAP = {
  waiting: 'queued',
  delayed: 'queued',
  prioritized: 'queued',
  'waiting-children': 'queued',
  active: 'running',
  completed: 'completed',
  failed: 'failed',
};

async function describeJob(job) {
  const state = STATE_MAP[await job.getState()] ?? 'unknown';
  const progress =
    job.progress && typeof job.progress === 'object'
      ? job.progress
      : { percent: Number(job.progress) || 0, stage: 'queued', message: 'Waiting in queue' };

  return {
    jobId: String(job.id),
    state,
    progress,
    result: state === 'completed' ? job.returnvalue : null,
    error: state === 'failed' ? job.failedReason : null,
  };
}

export async function readGenerationJob(projectId, jobId) {
  const job = await queues.GENERATE_TESTS.getJob(jobId);
  if (!job || job.data.projectId !== projectId) throw ApiError.notFound('Generation job not found');
  return describeJob(job);
}

export async function getGenerationJob(projectId, jobId, user) {
  await assertProjectAccess(projectId, user);
  return readGenerationJob(projectId, jobId);
}

export async function getActiveGeneration(projectId, user) {
  await assertProjectAccess(projectId, user);
  const job = await findActiveGeneration(projectId);
  return job ? describeJob(job) : null;
}

export async function startGeneration(projectId, user, opts) {
  await assertProjectAccess(projectId, user);

  const ready = await prisma.requirement.findMany({
    where: {
      projectId,
      status: 'READY',
      ...(opts.requirementIds && { id: { in: opts.requirementIds } }),
    },
    select: { id: true },
  });
  if (ready.length === 0) {
    throw ApiError.badRequest('Index at least one requirement before generating test cases');
  }

  if (await findActiveGeneration(projectId)) {
    throw ApiError.conflict('A generation is already running for this project');
  }

  const job = await enqueueGenerateTests({
    projectId,
    userId: user.id,
    types: [...new Set(opts.types)],
    perType: opts.perType,
    module: opts.module,
    // undefined = search every indexed requirement
    requirementIds: opts.requirementIds ? ready.map((r) => r.id) : undefined,
    // link the cases to a requirement only when there is exactly one source
    requirementId: ready.length === 1 ? ready[0].id : null,
  });

  return { jobId: String(job.id) };
}