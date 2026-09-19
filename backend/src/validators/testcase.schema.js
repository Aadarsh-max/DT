import { z } from 'zod';

export const TEST_TYPES = ['FUNCTIONAL', 'BOUNDARY', 'NEGATIVE', 'SECURITY', 'API', 'MOBILE'];
export const GENERATABLE_TYPES = ['FUNCTIONAL', 'BOUNDARY', 'NEGATIVE', 'SECURITY', 'API'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const emptyTo = (replacement, schema) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

export const generateSchema = z.object({
  types: z.array(z.enum(GENERATABLE_TYPES)).min(1, 'Pick at least one test type').default([...GENERATABLE_TYPES]),
  perType: z.coerce.number().int().min(1).max(8).default(3),
  module: emptyTo(undefined, z.string().trim().max(100).optional()),
  requirementIds: z.array(z.string().uuid()).min(1).optional(),
});

export const updateTestCaseSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: emptyTo(null, z.string().trim().max(2000).nullable()),
    module: emptyTo(null, z.string().trim().max(80).nullable()),
    type: z.enum(TEST_TYPES),
    priority: z.enum(PRIORITIES),
    preconditions: emptyTo(null, z.string().trim().max(2000).nullable()),
    steps: z.array(z.string().trim().min(1).max(500)).max(30),
    expectedResult: emptyTo(null, z.string().trim().max(2000).nullable()),
    testData: z.record(z.string(), z.any()).nullable(),
  })
  .partial();

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const listQuerySchema = z.object({
  type: emptyTo(undefined, z.enum(TEST_TYPES).optional()),
  priority: emptyTo(undefined, z.enum(PRIORITIES).optional()),
  module: emptyTo(undefined, z.string().trim().max(80).optional()),
  search: emptyTo(undefined, z.string().trim().max(100).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});