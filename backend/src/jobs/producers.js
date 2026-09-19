import { queues } from '../config/queue.js';

// attempts: 1 because a retry would re-run types that were already saved
export function enqueueGenerateTests(data) {
  return queues.GENERATE_TESTS.add('generate', data, { attempts: 1 });
}

export async function findActiveGeneration(projectId) {
  const jobs = await queues.GENERATE_TESTS.getJobs(['active', 'waiting', 'delayed'], 0, 50);
  return jobs.find((j) => j?.data?.projectId === projectId) ?? null;
}