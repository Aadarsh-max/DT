import { asyncHandler } from '../utils/asyncHandler.js';
import { listNotifications, markAllRead, markRead } from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listNotifications(req.user) });
});

export const read = asyncHandler(async (req, res) => {
  await markRead(req.params.id, req.user);
  res.json({ success: true });
});

export const readAll = asyncHandler(async (req, res) => {
  await markAllRead(req.user);
  res.json({ success: true });
});