import api from './api';

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

export const runService = {
  list: (projectId, params) =>
    api.get(`/projects/${projectId}/runs`, { params: clean(params) }).then((r) => r.data.data),
  create: (projectId, payload) =>
    api.post(`/projects/${projectId}/runs`, payload).then((r) => r.data.data.run),
  get: (id) => api.get(`/runs/${id}`).then((r) => r.data.data.run),
  results: (id, params) => api.get(`/runs/${id}/results`, { params: clean(params) }).then((r) => r.data.data),
  result: (id) => api.get(`/results/${id}`).then((r) => r.data.data.result),
  cancel: (id) => api.post(`/runs/${id}/cancel`).then((r) => r.data.data.run),
  remove: (id) => api.delete(`/runs/${id}`).then((r) => r.data),
  dashboard: (projectId) => api.get(`/projects/${projectId}/dashboard`).then((r) => r.data.data),

  // The screenshot route needs the auth header, so an <img src> cannot load it directly
  screenshot: (resultId) =>
    api.get(`/results/${resultId}/screenshot`, { responseType: 'blob' }).then((r) => r.data),

  apiTest: (projectId, payload) =>
    api.post(`/projects/${projectId}/api-test`, payload, { timeout: 60000 }).then((r) => r.data.data.result),
};