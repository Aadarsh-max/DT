import { z } from 'zod';
import { GENERATABLE_TYPES } from './testcase.schema.js';

const blank = (schema, replacement = undefined) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

const httpUrl = z
  .string()
  .trim()
  .url('Enter a valid URL, including http:// or https://')
  .refine((u) => /^https?:\/\//i.test(u), 'Only http and https URLs are supported');

export const createRunSchema = z.object({
  targetUrl: blank(httpUrl.optional()),
  apiBaseUrl: blank(httpUrl.optional()),
  types: z
    .array(z.enum(GENERATABLE_TYPES))
    .min(1, 'Pick at least one test type')
    .default([...GENERATABLE_TYPES]),
  maxCases: z.coerce.number().int().min(1).max(100).default(20),
  testCaseIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  headless: z.boolean().default(true),
  authToken: blank(z.string().trim().max(4000).optional()),
});

export const apiQuickSchema = z.object({
  baseUrl: blank(httpUrl.optional()),
  authToken: blank(z.string().trim().max(4000).optional()),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  endpoint: z.string().trim().min(1, 'Enter an endpoint or URL').max(2000),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.any().optional(),
  expectedStatus: z.coerce.number().int().min(100).max(599).optional(),
});

export const listRunsQuerySchema = z.object({
  status: blank(z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const resultsQuerySchema = z.object({
  status: blank(z.enum(['PASSED', 'FAILED', 'ERROR', 'SKIPPED']).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});