import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../services/project.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { projects: await listProjects(req.user) } });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { project: await getProject(req.params.id, req.user) } });
});

export const create = asyncHandler(async (req, res) => {
  const project = await createProject(req.user, req.body);
  res.status(201).json({ success: true, data: { project } });
});

export const update = asyncHandler(async (req, res) => {
  const project = await updateProject(req.params.id, req.user, req.body);
  res.json({ success: true, data: { project } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteProject(req.params.id, req.user);
  res.json({ success: true, message: 'Project deleted' });
});