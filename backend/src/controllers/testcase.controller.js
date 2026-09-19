import { asyncHandler } from '../utils/asyncHandler.js';
import { openSse } from '../utils/sse.js';
import { listQuerySchema } from '../validators/testcase.schema.js';
import {
  bulkDeleteTestCases,
  deleteTestCase,
  getActiveGeneration,
  getGenerationJob,
  getTestCase,
  listTestCases,
  readGenerationJob,
  startGeneration,
  updateTestCase,
} from '../services/testcase.service.js';

const FINISHED = ['completed', 'failed', 'unknown'];
const MAX_STREAM_MS = 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const data = await listTestCases(req.params.projectId, req.user, query);
  res.json({ success: true, data });
});

export const get = asyncHandler(async (req, res) => {
  const testCase = await getTestCase(req.params.id, req.user);
  res.json({ success: true, data: { testCase } });
});

export const update = asyncHandler(async (req, res) => {
  const testCase = await updateTestCase(req.params.id, req.user, req.body);
  res.json({ success: true, data: { testCase } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteTestCase(req.params.id, req.user);
  res.json({ success: true, message: 'Test case deleted' });
});

export const bulkRemove = asyncHandler(async (req, res) => {
  const data = await bulkDeleteTestCases(req.params.projectId, req.user, req.body.ids);
  res.json({ success: true, data });
});

// 202 = accepted: the job runs in the background
export const generate = asyncHandler(async (req, res) => {
  const data = await startGeneration(req.params.projectId, req.user, req.body);
  res.status(202).json({ success: true, data });
});

export const activeGeneration = asyncHandler(async (req, res) => {
  const job = await getActiveGeneration(req.params.projectId, req.user);
  res.json({ success: true, data: { job } });
});

export const generationStatus = asyncHandler(async (req, res) => {
  const { projectId, jobId } = req.params;
  const job = await getGenerationJob(projectId, jobId, req.user);
  res.json({ success: true, data: { job } });
});

export const generationEvents = asyncHandler(async (req, res) => {
  const { projectId, jobId } = req.params;

  // Checks access and existence BEFORE the stream opens, so errors are normal JSON
  let snapshot = await getGenerationJob(projectId, jobId, req.user);

  const sse = openSse(res);
  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const started = Date.now();
  while (!closed && Date.now() - started < MAX_STREAM_MS) {
    sse.send('progress', snapshot);
    if (FINISHED.includes(snapshot.state)) {
      sse.send('done', snapshot);
      break;
    }
    await sleep(1000);
    try {
      snapshot = await readGenerationJob(projectId, jobId);
    } catch (e) {
      sse.send('error', { message: e.message });
      break;
    }
  }
  sse.close();
});