import { asyncHandler } from '../utils/asyncHandler.js';
import { listBugsQuerySchema } from '../validators/bug.schema.js';
import {
  bugInsights,
  confirmDuplicate,
  deleteBug,
  dismissDuplicate,
  featuredBug,
  getBug,
  listBugs,
  startAnalyze,
  startFix,
  syncProjectBugs,
  updateBug,
} from '../services/bug.service.js';

export const list = asyncHandler(async (req, res) => {
  const query = listBugsQuerySchema.parse(req.query);
  res.json({ success: true, data: await listBugs(req.params.projectId, req.user, query) });
});

export const sync = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await syncProjectBugs(req.params.projectId, req.user) });
});

export const insights = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await bugInsights(req.params.projectId, req.user) });
});

export const featured = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { bug: await featuredBug(req.params.projectId, req.user) } });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { bug: await getBug(req.params.id, req.user) } });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { bug: await updateBug(req.params.id, req.user, req.body) } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteBug(req.params.id, req.user);
  res.json({ success: true, message: 'Bug deleted' });
});

// 202 = accepted: the job runs in the background
export const analyze = asyncHandler(async (req, res) => {
  await startAnalyze(req.params.id, req.user);
  res.status(202).json({ success: true, message: 'Analysis queued' });
});

export const fix = asyncHandler(async (req, res) => {
  await startFix(req.params.id, req.user);
  res.status(202).json({ success: true, message: 'Fix suggestion queued' });
});

export const confirmDup = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { bug: await confirmDuplicate(req.params.id, req.user) } });
});

export const dismissDup = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { bug: await dismissDuplicate(req.params.id, req.user) } });
});