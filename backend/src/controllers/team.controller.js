import { asyncHandler } from '../utils/asyncHandler.js';
import { addMember, changeUserRole, listMembers, removeMember } from '../services/team.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listMembers(req.params.projectId, req.user) });
});

export const add = asyncHandler(async (req, res) => {
  const data = await addMember(req.params.projectId, req.user, req.body.email);
  res.status(201).json({ success: true, data });
});

export const remove = asyncHandler(async (req, res) => {
  await removeMember(req.params.projectId, req.user, req.params.userId);
  res.json({ success: true, message: 'Removed from the team' });
});

export const setRole = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: await changeUserRole(req.user, req.params.id, req.body.role) } });
});