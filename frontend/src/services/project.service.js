import api from './api';

export const projectService = {
  list: () => api.get('/projects').then((r) => r.data.data.projects),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data.data.project),
  create: (payload) => api.post('/projects', payload).then((r) => r.data.data.project),
  update: (id, payload) => api.patch(`/projects/${id}`, payload).then((r) => r.data.data.project),
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),

  listRequirements: (projectId) =>
    api.get(`/projects/${projectId}/requirements`).then((r) => r.data.data.requirements),

  uploadFile: (projectId, { file, type, title }) => {
    const form = new FormData();
    form.append('file', file);
    if (type) form.append('type', type);
    if (title) form.append('title', title);
    return api
      .post(`/projects/${projectId}/requirements/file`, form)
      .then((r) => r.data.data.requirement);
  },

  addUrl: (projectId, payload) =>
    api.post(`/projects/${projectId}/requirements/url`, payload).then((r) => r.data.data.requirement),

  reindex: (id) => api.post(`/requirements/${id}/reindex`).then((r) => r.data.data.requirement),
  removeRequirement: (id) => api.delete(`/requirements/${id}`).then((r) => r.data),

  // Long timeout: the first query may wait while Ollama loads the embedding model
  search: (projectId, payload) =>
    api
      .post(`/projects/${projectId}/requirements/search`, payload, { timeout: 120000 })
      .then((r) => r.data.data),
};