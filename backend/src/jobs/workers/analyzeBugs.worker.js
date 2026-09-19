import { Worker } from 'bullmq';
import { prisma } from '../../config/db.js';
import { QUEUE_NAMES } from '../../config/queue.js';
import { redis } from '../../config/redis.js';
import { notifyCriticalBug } from '../../services/alerts.service.js';
import { analyzeBug, generateFix } from '../../services/bug.service.js';
import { logger } from '../../utils/logger.js';
import { clearBugJobError, setBugJobError } from '../producers.js';

async function analyzeProcessor(job) {
  const { bugId } = job.data;
  await clearBugJobError(bugId);

  const before = await prisma.bug.findUnique({ where: { id: bugId }, select: { severity: true } });
  try {
    const { warnings } = await analyzeBug(bugId);
    if (warnings?.length) await setBugJobError(bugId, 'analyze', warnings[0]);
  } catch (e) {
    await setBugJobError(bugId, 'analyze', e.message);
    throw e;
  }

  // Alert only when this analysis made the bug Critical, and it is not a suspected duplicate
  const after = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { severity: true, duplicateOfId: true },
  });
  if (after?.severity === 'CRITICAL' && before?.severity !== 'CRITICAL' && !after.duplicateOfId) {
    await notifyCriticalBug(bugId);
  }
}

async function fixProcessor(job) {
  const { bugId } = job.data;
  await clearBugJobError(bugId);
  try {
    await generateFix(bugId);
  } catch (e) {
    await setBugJobError(bugId, 'fix', e.message);
    throw e;
  }
}

function make(name, queueName, processor) {
  // One at a time keeps RAM predictable: analysis uses the embedding model, fixes use the 7B coder
  const worker = new Worker(queueName, processor, {
    connection: redis,
    concurrency: 1,
    lockDuration: 10 * 60 * 1000,
  });
  worker.on('failed', (job, err) => logger.error(`${name} job ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => logger.error(`${name} worker error: ${err.message}`));
  logger.info(`${name} worker started`);
  return worker;
}

export const startAnalyzeBugsWorker = () => make('Analyze-bugs', QUEUE_NAMES.ANALYZE_BUGS, analyzeProcessor);
export const startFixBugWorker = () => make('Fix-bug', QUEUE_NAMES.FIX_BUG, fixProcessor);