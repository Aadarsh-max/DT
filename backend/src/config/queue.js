import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const QUEUE_NAMES = {
  GENERATE_TESTS: 'generate-tests',
  EXECUTE_RUN: 'execute-run',
  ANALYZE_BUGS: 'analyze-bugs',
  FIX_BUG: 'fix-bug',
  GENERATE_REPORT: 'generate-report',
};

const defaultJobOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 3000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const queues = Object.fromEntries(
  Object.entries(QUEUE_NAMES).map(([key, name]) => [
    key,
    new Queue(name, { connection: redis, defaultJobOptions }),
  ])
);

export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()));
}