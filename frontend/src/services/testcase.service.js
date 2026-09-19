import api from './api';

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

export const testcaseService = {
  list: (projectId, params) =>
    api.get(`/projects/${projectId}/testcases`, { params: clean(params) }).then((r) => r.data.data),

  update: (id, payload) => api.patch(`/testcases/${id}`, payload).then((r) => r.data.data.testCase),
  remove: (id) => api.delete(`/testcases/${id}`).then((r) => r.data),
  bulkRemove: (projectId, ids) =>
    api.post(`/projects/${projectId}/testcases/bulk-delete`, { ids }).then((r) => r.data.data),

  generate: (projectId, payload) =>
    api.post(`/projects/${projectId}/testcases/generate`, payload).then((r) => r.data.data),

  // Returns the running job (or null), so progress survives a page refresh
  activeGeneration: (projectId) =>
    api.get(`/projects/${projectId}/testcases/generate/active`).then((r) => r.data.data.job),
};