import api from './api';

export const chatService = {
  history: (projectId) => api.get(`/projects/${projectId}/chat`).then((r) => r.data.data.messages),
  ask: (projectId, message) =>
    api.post(`/projects/${projectId}/chat`, { message }, { timeout: 120000 }).then((r) => r.data.data),
  clear: (projectId) => api.delete(`/projects/${projectId}/chat`).then((r) => r.data),
};