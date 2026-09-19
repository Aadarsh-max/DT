import api from './api';

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

export const reportService = {
  list: (projectId, params = {}) =>
    api.get(`/projects/${projectId}/reports`, { params: clean(params) }).then((r) => r.data.data),
  get: (id) => api.get(`/reports/${id}`).then((r) => r.data.data.report),
  create: (projectId, payload) =>
    api.post(`/projects/${projectId}/reports`, payload).then((r) => r.data.data.report),
  remove: (id) => api.delete(`/reports/${id}`).then((r) => r.data),

  // The download route needs the auth header, so the file is fetched as a blob and saved
  async download(report) {
    const res = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(report.title || 'report').replace(/[^A-Za-z0-9._ -]+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};