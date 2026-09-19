import { Router } from 'express';
import {
  addUrl,
  list,
  reindex,
  remove,
  search,
  uploadFile,
} from '../controllers/requirement.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadRequirementFile } from '../middleware/upload.middleware.js';
import {
  ragSearchSchema,
  requirementFileSchema,
  requirementUrlSchema,
} from '../validators/project.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route (not router.use)
const router = Router();

router.get('/projects/:projectId/requirements', requireAuth, list);
router.post(
  '/projects/:projectId/requirements/file',
  requireAuth,
  uploadRequirementFile,
  validate(requirementFileSchema),
  uploadFile
);
router.post(
  '/projects/:projectId/requirements/url',
  requireAuth,
  validate(requirementUrlSchema),
  addUrl
);
router.post(
  '/projects/:projectId/requirements/search',
  requireAuth,
  validate(ragSearchSchema),
  search
);

router.post('/requirements/:id/reindex', requireAuth, reindex);
router.delete('/requirements/:id', requireAuth, remove);

export default router;