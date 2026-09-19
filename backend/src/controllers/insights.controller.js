import { asyncHandler } from '../utils/asyncHandler.js';
import { getRunRisk } from '../services/risk.service.js';

export const risk = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { risk: await getRunRisk(req.params.id, req.user) } });
});