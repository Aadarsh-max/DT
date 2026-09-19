import { asyncHandler } from '../utils/asyncHandler.js';
import { askAssistant, clearChat, listChat } from '../services/chat.service.js';

export const history = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { messages: await listChat(req.params.projectId, req.user) } });
});

export const ask = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await askAssistant(req.params.projectId, req.user, req.body.message) });
});

export const clear = asyncHandler(async (req, res) => {
  await clearChat(req.params.projectId, req.user);
  res.json({ success: true, message: 'Conversation cleared' });
});