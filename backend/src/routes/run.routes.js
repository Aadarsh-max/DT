import { Router } from 'express';
import {
  apiTest,
  cancel,
  create,
  dashboard,
  events,
  get,
  list,
  remove,
  result,
  results,
  screenshot,
  status,
} from '../controllers/run.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { apiQuickSchema, createRunSchema } from '../validators/run.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route
const router = Router();
const canWrite = requireRole('ADMIN', 'QA_ENGINEER', 'DEVELOPER');

router.get('/projects/:projectId/runs', requireAuth, list);
router.post('/projects/:projectId/runs', requireAuth, canWrite, validate(createRunSchema), create);
router.get('/projects/:projectId/dashboard', requireAuth, dashboard);
router.post('/projects/:projectId/api-test', requireAuth, canWrite, validate(apiQuickSchema), apiTest);

router.get('/runs/:id', requireAuth, get);
router.delete('/runs/:id', requireAuth, canWrite, remove);
router.get('/runs/:id/status', requireAuth, status);
router.get('/runs/:id/events', requireAuth, events);
router.get('/runs/:id/results', requireAuth, results);
router.post('/runs/:id/cancel', requireAuth, canWrite, cancel);

router.get('/results/:id', requireAuth, result);
router.get('/results/:id/screenshot', requireAuth, screenshot);

export default router;