import axios from 'axios';
import { useAuthStore } from '@/lib/store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export const loginUser = async (email: string, password: string) => {
  const res = await api.post('/api/auth/login', { email, password });
  const { token, user, permissions } = res.data.data;
  const store = useAuthStore.getState();
  store.setToken(token);
  store.setUser(user);
  if (permissions) {
    store.setPermissions(permissions);
  }
  return res.data.data;
};

export default api;
