import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { closeQueues } from './config/queue.js';
import { logger } from './utils/logger.js';

async function start() {
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  // Indexing runs in-process, so a restart leaves rows stuck in INDEXING
  const stuck = await prisma.requirement.updateMany({
    where: { status: { in: ['PENDING', 'INDEXING'] } },
    data: {
      status: 'FAILED',
      errorMsg: 'Indexing was interrupted by a server restart. Click Re-index.',
    },
  });
  if (stuck.count) logger.warn(`Marked ${stuck.count} interrupted requirement(s) as FAILED`);

  const server = app.listen(env.PORT, () => {
    logger.info(`Backend running on http://localhost:${env.PORT}`);
  });

  // Workers are started here in later phases.

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await closeQueues();
      await redis.quit();
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});