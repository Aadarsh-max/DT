import { Router } from 'express';
import { create, get, list, remove, update } from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createProjectSchema, updateProjectSchema } from '../validators/project.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/', list);
router.post('/', validate(createProjectSchema), create);
router.get('/:id', get);
router.patch('/:id', validate(updateProjectSchema), update);
router.delete('/:id', remove);

export default router;