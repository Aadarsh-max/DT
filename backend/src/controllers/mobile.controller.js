import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createMobileRun,
  getMobileConfig,
  mobileEngineStatus,
  removeApk,
  saveApk,
  saveMobileConfig,
} from '../services/mobile.service.js';

export const engineStatus = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await mobileEngineStatus() });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { config: await getMobileConfig(req.params.projectId, req.user) } });
});

export const save = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { config: await saveMobileConfig(req.params.projectId, req.user, req.body) } });
});

export const upload = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { config: await saveApk(req.params.projectId, req.user, req.file) } });
});

export const removeApkFile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { config: await removeApk(req.params.projectId, req.user) } });
});

// 202 = accepted: the run executes in the background
export const run = asyncHandler(async (req, res) => {
  const created = await createMobileRun(req.params.projectId, req.user, req.body);
  res.status(202).json({ success: true, data: { run: created } });
});