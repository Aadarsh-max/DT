import { Router } from 'express';
import {
  analyze,
  confirmDup,
  dismissDup,
  featured,
  fix,
  get,
  insights,
  list,
  remove,
  sync,
  update,
} from '../controllers/bug.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateBugSchema } from '../validators/bug.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route
const router = Router();
const canWrite = requireRole('ADMIN', 'QA_ENGINEER', 'DEVELOPER');

router.get('/projects/:projectId/bugs', requireAuth, list);
router.post('/projects/:projectId/bugs/sync', requireAuth, canWrite, sync);
router.get('/projects/:projectId/bugs/insights', requireAuth, insights);
router.get('/projects/:projectId/bugs/featured', requireAuth, featured);

router.get('/bugs/:id', requireAuth, get);
router.patch('/bugs/:id', requireAuth, canWrite, validate(updateBugSchema), update);
router.delete('/bugs/:id', requireAuth, canWrite, remove);
router.post('/bugs/:id/analyze', requireAuth, canWrite, analyze);
router.post('/bugs/:id/fix', requireAuth, canWrite, fix);
router.post('/bugs/:id/duplicate/confirm', requireAuth, canWrite, confirmDup);
router.post('/bugs/:id/duplicate/dismiss', requireAuth, canWrite, dismissDup);

export default router;