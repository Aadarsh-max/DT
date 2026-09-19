import axios from 'axios';

export const TOKEN_KEY = 'auth_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

// Turns any axios error into a readable message
export function getErrorMessage(err, fallback = 'Something went wrong') {
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?';
  const data = err.response?.data;
  if (data?.details && typeof data.details === 'object') {
    const first = Object.values(data.details).flat()[0];
    if (first) return first;
  }
  return data?.message || fallback;
}

export default api;