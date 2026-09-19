import { z } from 'zod';

const blank = (schema, replacement = undefined) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

export const createReportSchema = z.object({
  runId: blank(z.string().uuid().optional()),
  title: blank(z.string().trim().max(200).optional()),
});

export const listReportsQuerySchema = z.object({
  runId: blank(z.string().uuid().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const analyticsQuerySchema = z.object({
  days: blank(z.coerce.number().int().min(1).max(365).optional()),
});