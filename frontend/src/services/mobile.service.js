import api from './api';

export const mobileService = {
  status: () => api.get('/mobile/status', { timeout: 45000 }).then((r) => r.data.data),
  get: (projectId) => api.get(`/projects/${projectId}/mobile`).then((r) => r.data.data.config),
  save: (projectId, payload) => api.put(`/projects/${projectId}/mobile`, payload).then((r) => r.data.data.config),
  uploadApk: (projectId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post(`/projects/${projectId}/mobile/apk`, form, { timeout: 10 * 60 * 1000 })
      .then((r) => r.data.data.config);
  },
  removeApk: (projectId) => api.delete(`/projects/${projectId}/mobile/apk`).then((r) => r.data.data.config),
  run: (projectId, payload) => api.post(`/projects/${projectId}/mobile/runs`, payload).then((r) => r.data.data.run),
};