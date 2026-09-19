import { Worker } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue.js';
import { redis } from '../../config/redis.js';
import { analyzeBug, generateFix } from '../../services/bug.service.js';
import { logger } from '../../utils/logger.js';
import { clearBugJobError, setBugJobError } from '../producers.js';

async function analyzeProcessor(job) {
  const { bugId } = job.data;
  await clearBugJobError(bugId);
  try {
    const { warnings } = await analyzeBug(bugId);
    if (warnings?.length) await setBugJobError(bugId, 'analyze', warnings[0]);
  } catch (e) {
    await setBugJobError(bugId, 'analyze', e.message);
    throw e;
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