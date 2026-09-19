import { z } from 'zod';

export const BUG_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE'];

const blank = (schema, replacement = undefined) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

export const listBugsQuerySchema = z.object({
  status: blank(z.enum(BUG_STATUSES).optional()),
  severity: blank(z.enum(BUG_SEVERITIES).optional()),
  search: blank(z.string().trim().max(100).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export const updateBugSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: blank(z.string().trim().max(4000).nullable(), null),
    severity: z.enum(BUG_SEVERITIES),
    status: z.enum(BUG_STATUSES),
    assigneeId: z.string().uuid().nullable(),
  })
  .partial();