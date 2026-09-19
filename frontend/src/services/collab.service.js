import api from './api';

export const collabService = {
  team: {
    list: (projectId) => api.get(`/projects/${projectId}/members`).then((r) => r.data.data),
    add: (projectId, email) => api.post(`/projects/${projectId}/members`, { email }).then((r) => r.data.data),
    remove: (projectId, userId) => api.delete(`/projects/${projectId}/members/${userId}`).then((r) => r.data),
    setRole: (userId, role) => api.patch(`/team/users/${userId}/role`, { role }).then((r) => r.data),
  },

  comments: {
    list: (bugId) => api.get(`/bugs/${bugId}/comments`).then((r) => r.data.data.comments),
    add: (bugId, body) => api.post(`/bugs/${bugId}/comments`, { body }).then((r) => r.data.data.comment),
    remove: (id) => api.delete(`/comments/${id}`).then((r) => r.data),
  },

  notifications: {
    list: () => api.get('/notifications').then((r) => r.data.data),
    read: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
    readAll: () => api.post('/notifications/read-all').then((r) => r.data),
  },

  integrations: {
    list: (projectId) => api.get(`/projects/${projectId}/integrations`).then((r) => r.data.data),
    save: (projectId, type, payload) =>
      api.put(`/projects/${projectId}/integrations/${type}`, payload).then((r) => r.data.data.integration),
    remove: (projectId, type) => api.delete(`/projects/${projectId}/integrations/${type}`).then((r) => r.data),
    test: (projectId, type) =>
      api.post(`/projects/${projectId}/integrations/${type}/test`, null, { timeout: 60000 }).then((r) => r.data.data),
    createJira: (bugId) => api.post(`/bugs/${bugId}/jira`, null, { timeout: 60000 }).then((r) => r.data.data.issue),
  },
};