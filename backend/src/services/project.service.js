import fs from "node:fs/promises";
import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { aiEngine } from "./aiEngine.client.js";
import path from "node:path";
import { UPLOAD_DIR } from "../middleware/upload.middleware.js";

const countSelect = {
  _count: {
    select: { requirements: true, testCases: true, runs: true, bugs: true },
  },
};
const serialize = ({ _count, ...project }) => ({ ...project, counts: _count });

// Read access: admin, owner or member. manage: admin or owner only.
export async function assertProjectAccess(
  projectId,
  user,
  { manage = false } = {},
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { userId: true } } },
  });
  if (!project) throw ApiError.notFound("Project not found");

  const isAdmin = user.role === "ADMIN";
  const isOwner = project.ownerId === user.id;
  const isMember = project.members.some((m) => m.userId === user.id);
  const allowed = manage ? isAdmin || isOwner : isAdmin || isOwner || isMember;
  if (!allowed)
    throw ApiError.forbidden("You do not have access to this project");

  return project;
}

export async function listProjects(user) {
  const where =
    user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        };
  const projects = await prisma.project.findMany({
    where,
    include: countSelect,
    orderBy: { updatedAt: "desc" },
  });
  return projects.map(serialize);
}

export async function getProject(id, user) {
  await assertProjectAccess(id, user);
  const project = await prisma.project.findUnique({
    where: { id },
    include: countSelect,
  });
  return serialize(project);
}

export async function createProject(user, data) {
  const project = await prisma.project.create({
    data: { ...data, ownerId: user.id },
    include: countSelect,
  });
  return serialize(project);
}

export async function updateProject(id, user, data) {
  await assertProjectAccess(id, user, { manage: true });
  const project = await prisma.project.update({
    where: { id },
    data,
    include: countSelect,
  });
  return serialize(project);
}

export async function deleteProject(id, user) {
  await assertProjectAccess(id, user, { manage: true });
  const requirements = await prisma.requirement.findMany({
    where: { projectId: id },
    select: { filePath: true },
  });

  await prisma.project.delete({ where: { id } }); // cascades to all related rows

  await aiEngine
    .deleteProject(id)
    .catch((e) =>
      logger.warn(`Could not clear vector index for ${id}: ${e.message}`),
    );
  await Promise.all(
    requirements
      .filter((r) => r.filePath)
      .map((r) => fs.unlink(r.filePath).catch(() => {})),
  );
  await fs
    .rm(path.join(UPLOAD_DIR, "screenshots", id), {
      recursive: true,
      force: true,
    })
    .catch(() => {});
  await fs
    .rm(path.join(UPLOAD_DIR, "reports", id), { recursive: true, force: true })
    .catch(() => {});
}
