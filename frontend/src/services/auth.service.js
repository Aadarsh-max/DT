import api from './api';

export const authService = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data.user),
  updateProfile: (payload) => api.patch('/users/me', payload).then((r) => r.data.data.user),
  changePassword: (payload) => api.patch('/users/me/password', payload).then((r) => r.data),
};