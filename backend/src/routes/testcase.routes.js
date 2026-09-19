import { Router } from 'express';
import {
  activeGeneration,
  bulkRemove,
  generate,
  generationEvents,
  generationStatus,
  get,
  list,
  remove,
  update,
} from '../controllers/testcase.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  bulkDeleteSchema,
  generateSchema,
  updateTestCaseSchema,
} from '../validators/testcase.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route
const router = Router();
const canWrite = requireRole('ADMIN', 'QA_ENGINEER', 'DEVELOPER');

router.get('/projects/:projectId/testcases', requireAuth, list);

router.post(
  '/projects/:projectId/testcases/generate',
  requireAuth,
  canWrite,
  validate(generateSchema),
  generate
);
// "active" must be declared before ":jobId"
router.get('/projects/:projectId/testcases/generate/active', requireAuth, activeGeneration);
router.get('/projects/:projectId/testcases/generate/:jobId', requireAuth, generationStatus);
router.get('/projects/:projectId/testcases/generate/:jobId/events', requireAuth, generationEvents);

router.post(
  '/projects/:projectId/testcases/bulk-delete',
  requireAuth,
  canWrite,
  validate(bulkDeleteSchema),
  bulkRemove
);

router.get('/testcases/:id', requireAuth, get);
router.patch('/testcases/:id', requireAuth, canWrite, validate(updateTestCaseSchema), update);
router.delete('/testcases/:id', requireAuth, canWrite, remove);

export default router;