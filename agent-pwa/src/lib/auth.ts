import { create } from 'zustand';
import { api, tokenStore } from './api';

export interface AgentUser {
  userId: string;
  username: string;
  fullName?: string;
  role: string;
  branchId?: string | null;
  permissions: string[];
}

interface AuthState {
  user: AgentUser | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AgentUser | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  async init() {
    const t = tokenStore.access();
    if (!t) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const { data } = await api.get<AgentUser>('/auth/me');
      set({ user: data, loading: false });
    } catch {
      tokenStore.clear();
      set({ user: null, loading: false });
    }
  },

  async login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    tokenStore.setBoth(data.accessToken, data.refreshToken);
    const me = await api.get<AgentUser>('/auth/me');
    set({ user: me.data });
  },

  async logout() {
    try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
    tokenStore.clear();
    set({ user: null });
  },

  setUser(u) {
    set({ user: u });
  },
}));

// React to expired tokens fired from the axios interceptor
window.addEventListener('auth:expired', () => {
  tokenStore.clear();
  useAuth.getState().setUser(null);
});

export function hasPerm(user: AgentUser | null, code: string): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.permissions.includes(code);
}
