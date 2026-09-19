import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { notifyUsers } from './notification.service.js';
import { assertProjectAccess } from './project.service.js';

const userSel = { id: true, name: true, email: true, role: true };
const isManager = (project, user) => user.role === 'ADMIN' || project.ownerId === user.id;

export async function listMembers(projectId, user) {
  const project = await assertProjectAccess(projectId, user);
  const [owner, members] = await Promise.all([
    prisma.user.findUnique({ where: { id: project.ownerId }, select: userSel }),
    prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: userSel } },
    }),
  ]);
  return {
    owner,
    members: members.map((m) => ({ ...m.user, joinedAt: m.createdAt })),
    canManage: isManager(project, user),
    isAdmin: user.role === 'ADMIN',
  };
}

export async function addMember(projectId, user, email) {
  const project = await assertProjectAccess(projectId, user, { manage: true });

  const target = await prisma.user.findUnique({ where: { email }, select: userSel });
  if (!target) throw ApiError.notFound('No account with that email. Ask them to register first.');
  if (target.id === project.ownerId) throw ApiError.conflict('That person owns this project already');
  if (project.members.some((m) => m.userId === target.id)) {
    throw ApiError.conflict('That person is already on the team');
  }

  await prisma.projectMember.create({ data: { projectId, userId: target.id, role: target.role } });
  await notifyUsers([target.id], {
    title: `You were added to ${project.name}`,
    message: `${user.name} added you to the team.`,
    link: `/projects/${projectId}`,
  });
  return listMembers(projectId, user);
}

export async function removeMember(projectId, user, userId) {
  const project = await assertProjectAccess(projectId, user);
  const leaving = userId === user.id;
  if (!leaving && !isManager(project, user)) throw ApiError.forbidden('Only the project owner can remove people');
  if (userId === project.ownerId) throw ApiError.badRequest('The project owner cannot be removed');

  const res = await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  if (res.count === 0) throw ApiError.notFound('That person is not on the team');

  // Their bugs go back to unassigned
  await prisma.bug.updateMany({ where: { projectId, assigneeId: userId }, data: { assigneeId: null } });
  if (!leaving) {
    await notifyUsers([userId], {
      title: `You were removed from ${project.name}`,
      message: `${user.name} removed you from the team.`,
    });
  }
}

export async function changeUserRole(actor, targetId, role) {
  if (actor.id === targetId) throw ApiError.badRequest("You can't change your own role");
  return prisma.user.update({ where: { id: targetId }, data: { role }, select: { id: true, role: true } });
}