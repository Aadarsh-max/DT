import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { aiEngine } from './aiEngine.client.js';
import { assertProjectAccess } from './project.service.js';

const ACTIVE = ['PENDING', 'INDEXING'];

function inferType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.pdf', '.docx', '.txt', '.md', '.csv', '.html', '.htm'].includes(ext)) return 'DOCUMENT';
  if (['.json', '.yaml', '.yml'].includes(ext)) return 'API_SPEC';
  return 'CODE';
}

const safeUnlink = (p) => (p ? fs.unlink(p).catch(() => {}) : Promise.resolve());

// Runs after the HTTP response has been sent. Never throws.
async function runIndexing(requirementId, task) {
  try {
    const result = await task();
    await prisma.requirement.update({
      where: { id: requirementId },
      data: { status: 'READY', chunkCount: result.chunk_count ?? 0, errorMsg: null },
    });
  } catch (e) {
    logger.error(`Indexing failed for ${requirementId}: ${e.message}`);
    await prisma.requirement
      .update({
        where: { id: requirementId },
        data: { status: 'FAILED', chunkCount: 0, errorMsg: String(e.message).slice(0, 500) },
      })
      .catch(() => {}); // the row may have been deleted meanwhile
  }
}

async function getRequirementOrThrow(id, user) {
  const requirement = await prisma.requirement.findUnique({ where: { id } });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  await assertProjectAccess(requirement.projectId, user);
  return requirement;
}

export async function listRequirements(projectId, user) {
  await assertProjectAccess(projectId, user);
  return prisma.requirement.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
}

export async function addFileRequirement(projectId, user, file, { type, title } = {}) {
  if (!file) throw ApiError.badRequest('No file received. Attach it in the "file" field.');

  try {
    await assertProjectAccess(projectId, user);
  } catch (e) {
    await safeUnlink(file.path);
    throw e;
  }

  const requirement = await prisma.requirement.create({
    data: {
      projectId,
      title: title || file.originalname,
      type: type || inferType(file.originalname),
      filePath: file.path,
      status: 'INDEXING',
    },
  });

  void runIndexing(requirement.id, () =>
    aiEngine.indexFile({
      projectId,
      requirementId: requirement.id,
      filePath: file.path,
      filename: file.originalname,
    })
  );
  return requirement;
}

export async function addUrlRequirement(projectId, user, { url, title }) {
  await assertProjectAccess(projectId, user);

  const parsed = new URL(url);
  const requirement = await prisma.requirement.create({
    data: {
      projectId,
      title: title || `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, ''),
      type: 'URL',
      sourceUrl: url,
      status: 'INDEXING',
    },
  });

  void runIndexing(requirement.id, () =>
    aiEngine.indexUrl({ projectId, requirementId: requirement.id, url })
  );
  return requirement;
}

export async function reindexRequirement(id, user) {
  const requirement = await getRequirementOrThrow(id, user);
  if (ACTIVE.includes(requirement.status)) throw ApiError.conflict('Already indexing');

  let task;
  if (requirement.type === 'URL') {
    task = () =>
      aiEngine.indexUrl({
        projectId: requirement.projectId,
        requirementId: id,
        url: requirement.sourceUrl,
      });
  } else {
    const exists = requirement.filePath
      ? await fs.access(requirement.filePath).then(() => true, () => false)
      : false;
    if (!exists) throw ApiError.badRequest('The original file is missing. Upload it again.');
    task = () =>
      aiEngine.indexFile({
        projectId: requirement.projectId,
        requirementId: id,
        filePath: requirement.filePath,
        filename: path.basename(requirement.filePath), // keeps the original extension
      });
  }

  const updated = await prisma.requirement.update({
    where: { id },
    data: { status: 'INDEXING', errorMsg: null },
  });
  void runIndexing(id, task);
  return updated;
}

export async function deleteRequirement(id, user) {
  const requirement = await getRequirementOrThrow(id, user);
  if (ACTIVE.includes(requirement.status)) {
    throw ApiError.conflict('Wait for indexing to finish before deleting');
  }

  await aiEngine
    .deleteRequirement(requirement.projectId, id)
    .catch((e) => logger.warn(`Could not remove vectors for ${id}: ${e.message}`));
  await safeUnlink(requirement.filePath);
  await prisma.requirement.delete({ where: { id } });
}

export async function searchRequirements(projectId, user, { query, topK, requirementIds }) {
  await assertProjectAccess(projectId, user);

  const ready = await prisma.requirement.count({ where: { projectId, status: 'READY' } });
  if (ready === 0) return { results: [], engine: null };

  const data = await aiEngine.search({ projectId, query, topK, requirementIds });
  return {
    engine: data.engine,
    results: data.results.map((r) => ({
      requirementId: r.requirement_id,
      source: r.source,
      chunkIndex: r.chunk_index,
      text: r.text,
      score: r.score,
    })),
  };
}