import { asyncHandler } from '../utils/asyncHandler.js';
import { analyticsQuerySchema } from '../validators/report.schema.js';
import { projectAnalytics } from '../services/analytics.service.js';

export const get = asyncHandler(async (req, res) => {
  const query = analyticsQuerySchema.parse(req.query);
  res.json({ success: true, data: await projectAnalytics(req.params.projectId, req.user, query) });
});