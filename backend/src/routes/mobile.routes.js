import { Router } from 'express';
import { engineStatus, get, removeApkFile, run, save, upload } from '../controllers/mobile.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { uploadApk } from '../middleware/apkUpload.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { mobileConfigSchema, mobileRunSchema } from '../validators/mobile.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route
const router = Router();
const canWrite = requireRole('ADMIN', 'QA_ENGINEER', 'DEVELOPER');

router.get('/mobile/status', requireAuth, engineStatus);

router.get('/projects/:projectId/mobile', requireAuth, get);
router.put('/projects/:projectId/mobile', requireAuth, canWrite, validate(mobileConfigSchema), save);
router.post('/projects/:projectId/mobile/apk', requireAuth, canWrite, uploadApk, upload);
router.delete('/projects/:projectId/mobile/apk', requireAuth, canWrite, removeApkFile);
router.post('/projects/:projectId/mobile/runs', requireAuth, canWrite, validate(mobileRunSchema), run);

export default router;