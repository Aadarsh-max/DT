import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = crypto
  .createHash('sha256')
  .update(env.ENCRYPTION_KEY || env.JWT_SECRET)
  .digest();
const PREFIX = 'enc:v1:';

export function seal(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

// Throws if the value is not sealed or the key changed
export function unseal(sealed) {
  if (typeof sealed !== 'string' || !sealed.startsWith(PREFIX)) throw new Error('Unreadable secret');
  const [iv, tag, data] = sealed
    .slice(PREFIX.length)
    .split('.')
    .map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function tryUnseal(sealed) {
  try {
    return sealed ? unseal(sealed) : null;
  } catch {
    return null;
  }
}