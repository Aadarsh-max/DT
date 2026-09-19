import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { INTEGRATION_SCHEMAS } from '../validators/collab.schema.js';
import {
  TYPES,
  createJiraIssueForBug,
  listIntegrations,
  removeIntegration,
  saveIntegration,
  testIntegration,
} from '../services/integration.service.js';

const parseType = (value) => {
  const type = String(value).toUpperCase();
  if (!TYPES.includes(type)) throw ApiError.notFound('Unknown integration');
  return type;
};

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listIntegrations(req.params.projectId, req.user) });
});

export const save = asyncHandler(async (req, res) => {
  const type = parseType(req.params.type);
  const input = INTEGRATION_SCHEMAS[type].parse(req.body); // a ZodError becomes a 400
  const integration = await saveIntegration(req.params.projectId, req.user, type, input);
  res.json({ success: true, data: { integration } });
});

export const remove = asyncHandler(async (req, res) => {
  await removeIntegration(req.params.projectId, req.user, parseType(req.params.type));
  res.json({ success: true, message: 'Integration removed' });
});

export const test = asyncHandler(async (req, res) => {
  const data = await testIntegration(req.params.projectId, req.user, parseType(req.params.type));
  res.json({ success: true, data });
});

export const createJira = asyncHandler(async (req, res) => {
  const issue = await createJiraIssueForBug(req.params.id, req.user);
  res.status(201).json({ success: true, data: { issue } });
});