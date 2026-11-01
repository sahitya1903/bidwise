// The only place that makes HTTP calls and attaches the login token.
import axios from 'axios';

const TOKEN_KEY = 'bidwise_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: the session lasts until the tab closes */
    }
  },
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 10000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Every failure becomes { status, code, message, details } so pages can show error.message.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status ?? 0;
    const apiError = err.response?.data?.error;
    if (status === 401 && apiError?.code === 'INVALID_TOKEN') onUnauthorized();
    return Promise.reject({
      status,
      code: apiError?.code || (status ? 'HTTP_ERROR' : 'NETWORK_ERROR'),
      message: apiError?.message || (status ? `Request failed (${status})` : 'Cannot reach the server'),
      details: apiError?.details,
    });
  }
);

export default api;
