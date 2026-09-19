import { Router } from 'express';
import { ask, clear, history } from '../controllers/chat.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { chatLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { chatSchema } from '../validators/chat.schema.js';

// Mounted at "/" in routes/index.js, so auth is applied per route.
// Every role may chat: the assistant is read-only.
const router = Router();

router.get('/projects/:projectId/chat', requireAuth, history);
router.post('/projects/:projectId/chat', requireAuth, chatLimiter, validate(chatSchema), ask);
router.delete('/projects/:projectId/chat', requireAuth, clear);

export default router;