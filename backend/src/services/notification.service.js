import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// Owner and members of a project
export async function projectPeople(projectId) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  if (!p) return [];
  return [...new Set([p.ownerId, ...p.members.map((m) => m.userId)])];
}

// Never throws: a failed notification must not break the action that caused it
export async function notifyUsers(userIds, { title, message, link }) {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        title: clip(title, 150),
        message: message ? clip(message, 300) : null,
        link: link ?? null,
      })),
    });
  } catch (e) {
    logger.warn(`Could not create notifications: ${e.message}`);
  }
}

export async function notifyProject(projectId, payload, { exclude = [] } = {}) {
  try {
    const people = (await projectPeople(projectId)).filter((id) => !exclude.includes(id));
    await notifyUsers(people, payload);
  } catch (e) {
    logger.warn(`Could not notify project ${projectId}: ${e.message}`);
  }
}

export async function listNotifications(user) {
  // Old notifications are dropped after 30 days
  prisma.notification
    .deleteMany({ where: { userId: user.id, createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } })
    .catch(() => {});

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return { items, unread };
}

export async function markRead(id, user) {
  await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
}

export async function markAllRead(user) {
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
}