import { create } from 'zustand';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Permission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  permissions: Permission[];
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setPermissions: (permissions: Permission[]) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasPermission: (module: string, action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => boolean;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
}

const getInitialToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tnt_token');
  }
  return null;
};

const getInitialUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('tnt_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
};

const getInitialPermissions = (): Permission[] => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('tnt_permissions');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
  }
  return [];
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getInitialToken(),
  user: getInitialUser(),
  permissions: getInitialPermissions(),
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tnt_user', JSON.stringify(user));
    }
    set({ user });
  },
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tnt_token', token);
    }
    set({ token });
  },
  setPermissions: (permissions) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tnt_permissions', JSON.stringify(permissions));
    }
    set({ permissions });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tnt_token');
      localStorage.removeItem('tnt_user');
      localStorage.removeItem('tnt_permissions');
    }
    set({ user: null, token: null, permissions: [] });
  },
  isAuthenticated: () => {
    const state = get();
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tnt_token') : null;
    return !!(state.token || stored);
  },
  hasPermission: (module, action) => {
    const { user, permissions } = get();
    
    if (user?.role === 'super_admin') return true;
    if (user?.role === 'manager') return true;
    
    if (!permissions || permissions.length === 0) {
      if (module === 'dashboard') return true;
      if (module === 'announcements') return true;
      return false;
    }
    
    const modulePerm = permissions.find((p) => p.module_name === module);
    if (!modulePerm) return false;
    
    return Boolean(modulePerm[action]);
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
}));
