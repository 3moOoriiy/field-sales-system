import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api';
export const SOCKET_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: API_BASE, timeout: 20_000 });

export const tokenStore = {
  access: () => localStorage.getItem('access_token'),
  refresh: () => localStorage.getItem('refresh_token'),
  setBoth(a: string, r: string) {
    localStorage.setItem('access_token', a);
    localStorage.setItem('refresh_token', r);
  },
  clear() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

api.interceptors.request.use((cfg) => {
  const t = tokenStore.access();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;
async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  const refresh = tokenStore.refresh();
  if (!refresh) return null;
  refreshing = (async () => {
    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
      tokenStore.setBoth(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      tokenStore.clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (err.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const fresh = await tryRefresh();
      if (fresh) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${fresh}` };
        return api.request(original);
      }
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(err);
  },
);

export function asMessage(e: unknown): string {
  const ax = e as AxiosError<{ message?: string | string[] }>;
  const m = ax.response?.data?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return ax.message ?? 'Network error';
}
