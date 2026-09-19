import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { closeQueues, queues } from './config/queue.js';
import { closeWorkers, startWorkers } from './jobs/workers/index.js';
import { logger } from './utils/logger.js';

async function recoverInterruptedWork() {
  // Requirement indexing runs in-process, so a restart leaves rows stuck in INDEXING
  const stuck = await prisma.requirement.updateMany({
    where: { status: { in: ['PENDING', 'INDEXING'] } },
    data: {
      status: 'FAILED',
      errorMsg: 'Indexing was interrupted by a server restart. Click Re-index.',
    },
  });
  if (stuck.count) logger.warn(`Marked ${stuck.count} interrupted requirement(s) as FAILED`);

  // A run that was executing when the server stopped cannot continue
  const running = await prisma.testRun.updateMany({
    where: { status: 'RUNNING' },
    data: {
      status: 'FAILED',
      errorMsg: 'The server restarted while this run was in progress.',
      finishedAt: new Date(),
    },
  });
  if (running.count) logger.warn(`Marked ${running.count} interrupted run(s) as FAILED`);

  // Queued runs keep their job in Redis. If the job is gone (Redis was reset), fail the run.
  const queued = await prisma.testRun.findMany({ where: { status: 'QUEUED' }, select: { id: true } });
  for (const r of queued) {
    if (!(await queues.EXECUTE_RUN.getJob(r.id))) {
      await prisma.testRun.update({
        where: { id: r.id },
        data: { status: 'FAILED', errorMsg: 'The queued job was lost. Start a new run.', finishedAt: new Date() },
      });
    }
  }

  // Reports that were generating when the server stopped: fail the ones whose job is gone
  const generating = await prisma.report.findMany({ where: { status: 'GENERATING' }, select: { id: true } });
  for (const r of generating) {
    const job = await queues.GENERATE_REPORT.getJob(r.id);
    const state = job ? await job.getState() : null;
    if (!job || ['failed', 'completed'].includes(state)) {
      await prisma.report.update({
        where: { id: r.id },
        data: { status: 'FAILED', errorMsg: 'The report was interrupted. Generate it again.' },
      });
    }
  }
}

async function start() {
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  await recoverInterruptedWork();

  const server = app.listen(env.PORT, () => {
    logger.info(`Backend running on http://localhost:${env.PORT}`);
  });

  const workers = startWorkers();

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await closeWorkers(workers);
      await closeQueues();
      await redis.quit();
      await prisma.$disconnect();
      process.exit(0);
    });
    server.closeAllConnections?.(); // ends open SSE streams so shutdown isn't blocked
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});