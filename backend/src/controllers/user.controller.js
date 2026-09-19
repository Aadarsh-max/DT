import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { changePassword, updateProfile } from '../services/auth.service.js';

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user.id, req.body);
  res.json({ success: true, data: { user } });
});

export const updateMyPassword = asyncHandler(async (req, res) => {
  await changePassword(req.user.id, req.body);
  res.json({ success: true, message: 'Password updated' });
});

// Admin only
export const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { users } });
});