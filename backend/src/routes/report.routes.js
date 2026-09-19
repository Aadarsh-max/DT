import { Router } from 'express';
import { create, download, get, list, remove } from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createReportSchema } from '../validators/report.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route
const router = Router();
const canWrite = requireRole('ADMIN', 'QA_ENGINEER', 'DEVELOPER');

router.get('/projects/:projectId/reports', requireAuth, list);
router.post('/projects/:projectId/reports', requireAuth, canWrite, validate(createReportSchema), create);

router.get('/reports/:id', requireAuth, get);
router.get('/reports/:id/download', requireAuth, download);
router.delete('/reports/:id', requireAuth, canWrite, remove);

export default router;