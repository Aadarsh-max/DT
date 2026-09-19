import { asyncHandler } from '../utils/asyncHandler.js';
import { loginUser, registerUser } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const data = await registerUser(req.body);
  res.status(201).json({ success: true, data });
});

export const login = asyncHandler(async (req, res) => {
  const data = await loginUser(req.body);
  res.json({ success: true, data });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});