import api from './api';

export const analyticsService = {
  get: (projectId, { days } = {}) =>
    api
      .get(`/projects/${projectId}/analytics`, { params: days ? { days } : {} })
      .then((r) => r.data.data),

  risk: (runId) => api.get(`/runs/${runId}/risk`).then((r) => r.data.data.risk),
};