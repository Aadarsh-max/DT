import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
});

export async function registerUser({ name, email, password }) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  return { user: publicUser(user), token: signToken(user) };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for both cases so emails can't be probed
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  return { user: publicUser(user), token: signToken(user) };
}

export async function updateProfile(userId, { name }) {
  const user = await prisma.user.update({ where: { id: userId }, data: { name } });
  return publicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}