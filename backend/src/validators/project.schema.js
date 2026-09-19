import { z } from 'zod';

// Turns blank strings into a replacement value before validating
const blank = (schema, replacement = null) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

const fields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: blank(z.string().trim().max(1000).nullable().optional()),
  baseUrl: blank(
    z.string().trim().url('Enter a valid URL, e.g. https://example.com').nullable().optional()
  ),
  platform: z.enum(['WEB', 'API', 'MOBILE']),
};

export const createProjectSchema = z.object({
  ...fields,
  platform: fields.platform.default('WEB'),
});

// No defaults here, so a partial update never resets other fields
export const updateProjectSchema = z.object(fields).partial();

export const requirementFileSchema = z.object({
  type: blank(z.enum(['DOCUMENT', 'API_SPEC', 'CODE']).optional(), undefined),
  title: blank(z.string().trim().max(200).optional(), undefined),
});

export const requirementUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Enter a valid URL, including http:// or https://')
    .refine((u) => /^https?:\/\//i.test(u), 'Only http and https URLs are supported'),
  title: blank(z.string().trim().max(200).optional(), undefined),
});

export const ragSearchSchema = z.object({
  query: z.string().trim().min(2, 'Type at least 2 characters').max(500),
  topK: z.coerce.number().int().min(1).max(20).default(5),
  requirementIds: z.array(z.string()).optional(),
});