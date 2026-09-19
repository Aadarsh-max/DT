import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { notifyUsers } from './notification.service.js';
import { assertProjectAccess } from './project.service.js';

const bugCode = (n) => `BUG-${String(n).padStart(4, '0')}`;
const snippet = (s) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 120 ? `${t.slice(0, 119)}…` : t;
};

async function loadBug(bugId, user) {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { id: true, projectId: true, number: true, assigneeId: true },
  });
  if (!bug) throw ApiError.notFound('Bug not found');
  const project = await assertProjectAccess(bug.projectId, user);
  return { bug, project };
}

export async function listComments(bugId, user) {
  const { project } = await loadBug(bugId, user);
  const rows = await prisma.comment.findMany({
    where: { bugId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { author: { select: { id: true, name: true } } },
  });
  const moderator = user.role === 'ADMIN' || project.ownerId === user.id;
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    author: c.author,
    canDelete: c.authorId === user.id || moderator,
  }));
}

export async function addComment(bugId, user, body) {
  const { bug } = await loadBug(bugId, user);

  const earlier = await prisma.comment.findMany({
    where: { bugId },
    select: { authorId: true },
    distinct: ['authorId'],
  });
  const comment = await prisma.comment.create({
    data: { bugId, authorId: user.id, body },
    include: { author: { select: { id: true, name: true } } },
  });

  // The assignee and everyone who already commented, except the author
  const targets = [bug.assigneeId, ...earlier.map((c) => c.authorId)].filter((id) => id && id !== user.id);
  await notifyUsers(targets, {
    title: `${user.name} commented on ${bugCode(bug.number)}`,
    message: snippet(body),
    link: `/bugs/${bug.id}`,
  });

  return { id: comment.id, body: comment.body, createdAt: comment.createdAt, author: comment.author, canDelete: true };
}

export async function deleteComment(id, user) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { bug: { select: { projectId: true } } },
  });
  if (!comment) throw ApiError.notFound('Comment not found');
  const project = await assertProjectAccess(comment.bug.projectId, user);
  const allowed = comment.authorId === user.id || user.role === 'ADMIN' || project.ownerId === user.id;
  if (!allowed) throw ApiError.forbidden('You can only delete your own comments');
  await prisma.comment.delete({ where: { id } });
}