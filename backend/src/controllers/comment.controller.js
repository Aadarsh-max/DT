import { asyncHandler } from '../utils/asyncHandler.js';
import { addComment, deleteComment, listComments } from '../services/comment.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { comments: await listComments(req.params.id, req.user) } });
});

export const add = asyncHandler(async (req, res) => {
  const comment = await addComment(req.params.id, req.user, req.body.body);
  res.status(201).json({ success: true, data: { comment } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteComment(req.params.id, req.user);
  res.json({ success: true, message: 'Comment deleted' });
});