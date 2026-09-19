import { Router } from 'express';
import { listUsers, updateMe, updateMyPassword } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { changePasswordSchema, updateProfileSchema } from '../validators/auth.schema.js';

const router = Router();

router.use(requireAuth);

router.patch('/me', validate(updateProfileSchema), updateMe);
router.patch('/me/password', validate(changePasswordSchema), updateMyPassword);
router.get('/', requireRole('ADMIN'), listUsers);

export default router;