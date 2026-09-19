import { Router } from 'express';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

async function checkAiEngine() {
  try {
    const res = await fetch(`${env.AI_ENGINE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, ...(await res.json()) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const checks = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (e) {
      checks.database = { ok: false, error: e.message };
    }

    try {
      checks.redis = { ok: (await redis.ping()) === 'PONG' };
    } catch (e) {
      checks.redis = { ok: false, error: e.message };
    }

    checks.aiEngine = await checkAiEngine();

    const ok = checks.database.ok && checks.redis.ok;
    res.status(ok ? 200 : 503).json({
      success: ok,
      service: 'backend',
      time: new Date().toISOString(),
      checks,
    });
  })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// More feature routers are mounted here in later phases.

export default router;