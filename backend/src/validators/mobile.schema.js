import { z } from 'zod';

const blank = (schema, replacement = undefined) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

export const mobileConfigSchema = z.object({
  appPackage: blank(
    z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/, 'A package name looks like com.example.app')
      .optional()
  ),
  appActivity: blank(
    z.string().trim().regex(/^[A-Za-z0-9_.$]{1,200}$/, 'That activity name has unusual characters').optional()
  ),
  udid: blank(z.string().trim().regex(/^[A-Za-z0-9._:-]{1,64}$/, 'That device id has unusual characters').optional()),
});

export const mobileRunSchema = z.object({
  maxCases: z.coerce.number().int().min(1).max(50).default(5),
  smartOrder: z.boolean().default(true),
  autoGrantPermissions: z.boolean().default(false),
  testCaseIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});