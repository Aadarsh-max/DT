import { startExecuteRunWorker } from './executeRun.worker.js';
import { startGenerateTestsWorker } from './generateTests.worker.js';

// Later phases add their workers to this list
export function startWorkers() {
  return [startGenerateTestsWorker(), startExecuteRunWorker()];
}

export async function closeWorkers(workers) {
  await Promise.all(workers.map((w) => w.close(true)));
}