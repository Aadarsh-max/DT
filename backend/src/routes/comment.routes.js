import { Router } from 'express';
import { add, list, remove } from '../controllers/comment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { apiLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { commentSchema } from '../validators/collab.schema.js';

// Every role with access to the project may comment, including VIEWER
const router = Router();

router.get('/bugs/:id/comments', requireAuth, list);
router.post('/bugs/:id/comments', requireAuth, apiLimiter, validate(commentSchema), add);
router.delete('/comments/:id', requireAuth, remove);

export default router;