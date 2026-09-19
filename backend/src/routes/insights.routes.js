import { Router } from 'express';
import { risk } from '../controllers/insights.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/runs/:id/risk', requireAuth, risk);

export default router;