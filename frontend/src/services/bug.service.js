import api from './api';

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

export const bugService = {
  list: (projectId, params) =>
    api.get(`/projects/${projectId}/bugs`, { params: clean(params) }).then((r) => r.data.data),
  sync: (projectId) => api.post(`/projects/${projectId}/bugs/sync`).then((r) => r.data.data),
  insights: (projectId) => api.get(`/projects/${projectId}/bugs/insights`).then((r) => r.data.data),
  featured: (projectId) => api.get(`/projects/${projectId}/bugs/featured`).then((r) => r.data.data.bug),

  get: (id) => api.get(`/bugs/${id}`).then((r) => r.data.data.bug),
  update: (id, payload) => api.patch(`/bugs/${id}`, payload).then((r) => r.data.data.bug),
  remove: (id) => api.delete(`/bugs/${id}`).then((r) => r.data),
  analyze: (id) => api.post(`/bugs/${id}/analyze`).then((r) => r.data),
  suggestFix: (id) => api.post(`/bugs/${id}/fix`).then((r) => r.data),
  confirmDuplicate: (id) => api.post(`/bugs/${id}/duplicate/confirm`).then((r) => r.data.data.bug),
  dismissDuplicate: (id) => api.post(`/bugs/${id}/duplicate/dismiss`).then((r) => r.data.data.bug),
};