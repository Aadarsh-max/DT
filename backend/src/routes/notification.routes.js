import { Router } from 'express';
import { list, read, readAll } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/notifications', requireAuth, list);
// "read-all" must be declared before ":id/read"
router.post('/notifications/read-all', requireAuth, readAll);
router.post('/notifications/:id/read', requireAuth, read);

export default router;