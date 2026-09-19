import { Router } from 'express';
import { get } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/projects/:projectId/analytics', requireAuth, get);

export default router;