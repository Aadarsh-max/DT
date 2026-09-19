import { queues } from '../config/queue.js';
import { redis } from '../config/redis.js';

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

// ───────── bugs ─────────

// One job per bug, in order, so duplicate detection always sees the earlier bugs first
export async function enqueueAnalyzeBugs(bugIds) {
  if (!bugIds.length) return [];
  return queues.ANALYZE_BUGS.addBulk(
    bugIds.map((bugId) => ({ name: 'analyze', data: { bugId }, opts: { attempts: 1 } }))
  );
}

export function enqueueFixBug(bugId) {
  return queues.FIX_BUG.add('fix', { bugId }, { attempts: 1 });
}

// Returns { kind: 'analyze' | 'fix', state: 'queued' | 'running' } or null
export async function findActiveBugJob(bugId) {
  for (const [kind, queue] of [
    ['analyze', queues.ANALYZE_BUGS],
    ['fix', queues.FIX_BUG],
  ]) {
    const jobs = await queue.getJobs(['active', 'waiting', 'delayed'], 0, 200);
    const job = jobs.find((j) => j?.data?.bugId === bugId);
    if (job) return { kind, state: (await job.getState()) === 'active' ? 'running' : 'queued' };
  }
  return null;
}

// The last failure is kept for an hour so the bug page can explain what went wrong
const errKey = (bugId) => `bugjob:error:${bugId}`;

export const setBugJobError = (bugId, kind, message) =>
  redis
    .set(errKey(bugId), JSON.stringify({ kind, message: String(message).slice(0, 300) }), 'EX', 3600)
    .catch(() => {});

export const clearBugJobError = (bugId) => redis.del(errKey(bugId)).catch(() => {});

export async function getBugJobError(bugId) {
  try {
    const value = await redis.get(errKey(bugId));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}