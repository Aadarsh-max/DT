import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// BullMQ requires maxRetriesPerRequest: null
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => logger.error('Redis error:', err.message));
redis.on('connect', () => logger.info('Redis connected'));