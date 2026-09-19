import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addFileRequirement,
  addUrlRequirement,
  deleteRequirement,
  listRequirements,
  reindexRequirement,
  searchRequirements,
} from '../services/requirement.service.js';

export const list = asyncHandler(async (req, res) => {
  const requirements = await listRequirements(req.params.projectId, req.user);
  res.json({ success: true, data: { requirements } });
});

// 202 = accepted: the file is stored, indexing continues in the background
export const uploadFile = asyncHandler(async (req, res) => {
  const requirement = await addFileRequirement(req.params.projectId, req.user, req.file, req.body);
  res.status(202).json({ success: true, data: { requirement } });
});

export const addUrl = asyncHandler(async (req, res) => {
  const requirement = await addUrlRequirement(req.params.projectId, req.user, req.body);
  res.status(202).json({ success: true, data: { requirement } });
});

export const reindex = asyncHandler(async (req, res) => {
  const requirement = await reindexRequirement(req.params.id, req.user);
  res.status(202).json({ success: true, data: { requirement } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteRequirement(req.params.id, req.user);
  res.json({ success: true, message: 'Requirement deleted' });
});

export const search = asyncHandler(async (req, res) => {
  const data = await searchRequirements(req.params.projectId, req.user, req.body);
  res.json({ success: true, data });
});