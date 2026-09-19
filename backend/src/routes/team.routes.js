import { Router } from 'express';
import { add, list, remove, setRole } from '../controllers/team.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { addMemberSchema, roleSchema } from '../validators/collab.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route.
// Who may add or remove people is checked in the service (owner or admin; anyone may leave).
const router = Router();

router.get('/projects/:projectId/members', requireAuth, list);
router.post('/projects/:projectId/members', requireAuth, validate(addMemberSchema), add);
router.delete('/projects/:projectId/members/:userId', requireAuth, remove);

router.patch('/team/users/:id/role', requireAuth, requireRole('ADMIN'), validate(roleSchema), setRole);

export default router;