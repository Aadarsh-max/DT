import { Router } from 'express';
import { createJira, list, remove, save, test } from '../controllers/integration.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

// Owner/admin checks happen in the service. requireRole blocks VIEWER accounts up front.
const router = Router();
const canWrite = requireRole('ADMIN', 'QA_ENGINEER', 'DEVELOPER');

router.get('/projects/:projectId/integrations', requireAuth, list);
router.put('/projects/:projectId/integrations/:type', requireAuth, canWrite, save);
router.delete('/projects/:projectId/integrations/:type', requireAuth, canWrite, remove);
router.post('/projects/:projectId/integrations/:type/test', requireAuth, canWrite, test);

router.post('/bugs/:id/jira', requireAuth, canWrite, createJira);

export default router;