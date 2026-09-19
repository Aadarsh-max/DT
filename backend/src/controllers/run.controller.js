import { asyncHandler } from '../utils/asyncHandler.js';
import { openSse } from '../utils/sse.js';
import { listRunsQuerySchema, resultsQuerySchema } from '../validators/run.schema.js';
import {
  cancelRun,
  createRun,
  dashboardData,
  deleteRun,
  getResult,
  getResultScreenshotFile,
  getRun,
  getRunSnapshot,
  listResults,
  listRuns,
  quickApiTest,
  readRunSnapshot,
} from '../services/run.service.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_STREAM_MS = 4 * 60 * 60 * 1000;

export const list = asyncHandler(async (req, res) => {
  const query = listRunsQuerySchema.parse(req.query);
  res.json({ success: true, data: await listRuns(req.params.projectId, req.user, query) });
});

// 202 = accepted: the run executes in the background
export const create = asyncHandler(async (req, res) => {
  const run = await createRun(req.params.projectId, req.user, req.body);
  res.status(202).json({ success: true, data: { run } });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { run: await getRun(req.params.id, req.user) } });
});

export const results = asyncHandler(async (req, res) => {
  const query = resultsQuerySchema.parse(req.query);
  res.json({ success: true, data: await listResults(req.params.id, req.user, query) });
});

export const result = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { result: await getResult(req.params.id, req.user) } });
});

export const screenshot = asyncHandler(async (req, res) => {
  const file = await getResultScreenshotFile(req.params.id, req.user);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file);
});

export const cancel = asyncHandler(async (req, res) => {
  const run = await cancelRun(req.params.id, req.user);
  res.json({ success: true, data: { run } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteRun(req.params.id, req.user);
  res.json({ success: true, message: 'Run deleted' });
});

export const status = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { job: await getRunSnapshot(req.params.id, req.user) } });
});

export const events = asyncHandler(async (req, res) => {
  const runId = req.params.id;

  // Checks access and existence BEFORE the stream opens, so errors are normal JSON
  let snapshot = await getRunSnapshot(runId, req.user);

  const sse = openSse(res);
  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const started = Date.now();
  while (!closed && Date.now() - started < MAX_STREAM_MS) {
    sse.send('progress', snapshot);
    if (['completed', 'failed'].includes(snapshot.state)) {
      sse.send('done', snapshot);
      break;
    }
    await sleep(1500);
    try {
      snapshot = await readRunSnapshot(runId);
    } catch (e) {
      sse.send('error', { message: e.message });
      break;
    }
  }
  sse.close();
});

export const dashboard = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await dashboardData(req.params.projectId, req.user) });
});

export const apiTest = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { result: await quickApiTest(req.params.projectId, req.user, req.body) } });
});