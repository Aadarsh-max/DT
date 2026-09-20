import { Router } from 'express';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import projectRoutes from './project.routes.js';
import requirementRoutes from './requirement.routes.js';
import testcaseRoutes from './testcase.routes.js';
import runRoutes from './run.routes.js';
import bugRoutes from './bug.routes.js';
import reportRoutes from './report.routes.js';
import analyticsRoutes from './analytics.routes.js';
import chatRoutes from './chat.routes.js';
import insightsRoutes from './insights.routes.js';
import commentRoutes from './comment.routes.js';
import teamRoutes from './team.routes.js';
import integrationRoutes from './integration.routes.js';
import notificationRoutes from './notification.routes.js';
import mobileRoutes from './mobile.routes.js';

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
router.use('/projects', projectRoutes);
router.use('/', requirementRoutes);
router.use('/', testcaseRoutes);
router.use('/', runRoutes);
router.use('/', bugRoutes);
router.use('/', reportRoutes);
router.use('/', analyticsRoutes);
router.use('/', chatRoutes);
router.use('/', insightsRoutes);
router.use('/', commentRoutes);
router.use('/', teamRoutes);
router.use('/', integrationRoutes);
router.use('/', notificationRoutes);
router.use('/', mobileRoutes);

// More feature routers are mounted here in later phases.

export default router;