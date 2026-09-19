import { asyncHandler } from '../utils/asyncHandler.js';
import { listReportsQuerySchema } from '../validators/report.schema.js';
import {
  createReport,
  deleteReport,
  getReport,
  getReportFile,
  listReports,
} from '../services/report.service.js';

export const list = asyncHandler(async (req, res) => {
  const query = listReportsQuerySchema.parse(req.query);
  res.json({ success: true, data: await listReports(req.params.projectId, req.user, query) });
});

// 202 = accepted: the report is generated in the background
export const create = asyncHandler(async (req, res) => {
  const report = await createReport(req.params.projectId, req.user, req.body);
  res.status(202).json({ success: true, data: { report } });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { report: await getReport(req.params.id, req.user) } });
});

export const download = asyncHandler(async (req, res) => {
  const { abs, filename } = await getReportFile(req.params.id, req.user);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.download(abs, filename);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteReport(req.params.id, req.user);
  res.json({ success: true, message: 'Report deleted' });
});