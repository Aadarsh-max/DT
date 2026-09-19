import { queues } from '../config/queue.js';

// attempts: 1 because a retry would re-run types that were already saved
export function enqueueGenerateTests(data) {
  return queues.GENERATE_TESTS.add('generate', data, { attempts: 1 });
}

export async function findActiveGeneration(projectId) {
  const jobs = await queues.GENERATE_TESTS.getJobs(['active', 'waiting', 'delayed'], 0, 50);
  return jobs.find((j) => j?.data?.projectId === projectId) ?? null;
}

// The job id is the run id, so a run can always find its own job
export function enqueueExecuteRun(data) {
  return queues.EXECUTE_RUN.add('execute', data, { jobId: data.runId, attempts: 1 });
}