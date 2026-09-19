import fs from 'node:fs/promises';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const INDEX_TIMEOUT_MS = 10 * 60 * 1000; // embedding on CPU can be slow

function messageFrom(data, status) {
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) return data.detail.map((d) => d.msg).join('; ');
  return `AI engine error (HTTP ${status})`;
}

async function call(path, { method = 'GET', json, form, timeoutMs = env.AI_ENGINE_TIMEOUT_MS } = {}) {
  const options = { method, signal: AbortSignal.timeout(timeoutMs) };
  if (json !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(json);
  }
  if (form) options.body = form;

  let res;
  try {
    res = await fetch(`${env.AI_ENGINE_URL}/api${path}`, options);
  } catch (e) {
    throw new ApiError(
      502,
      e.name === 'TimeoutError'
        ? 'The AI engine timed out'
        : `AI engine is not reachable at ${env.AI_ENGINE_URL}. Is uvicorn running on port 8002?`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status >= 500 ? 502 : res.status, messageFrom(data, res.status));
  return data;
}

export const aiEngine = {
  async indexFile({ projectId, requirementId, filePath, filename }) {
    const buffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append('project_id', projectId);
    form.append('requirement_id', requirementId);
    form.append('file', new Blob([buffer]), filename);
    return call('/requirements/index-file', { method: 'POST', form, timeoutMs: INDEX_TIMEOUT_MS });
  },

  indexUrl({ projectId, requirementId, url }) {
    return call('/requirements/index-url', {
      method: 'POST',
      json: { project_id: projectId, requirement_id: requirementId, url },
      timeoutMs: INDEX_TIMEOUT_MS,
    });
  },

  search({ projectId, query, topK = 5, requirementIds }) {
    return call('/requirements/search', {
      method: 'POST',
      json: { project_id: projectId, query, top_k: topK, requirement_ids: requirementIds },
    });
  },

  deleteRequirement(projectId, requirementId) {
    return call(
      `/requirements/${encodeURIComponent(projectId)}/${encodeURIComponent(requirementId)}`,
      { method: 'DELETE' }
    );
  },

  deleteProject(projectId) {
    return call(`/requirements/project/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  },
};