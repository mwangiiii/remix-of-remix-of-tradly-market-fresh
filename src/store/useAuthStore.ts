// Zustand store holding the JWT access token — IN MEMORY ONLY, never in
// localStorage/sessionStorage. Mirrors tradly-flow / tradly-super-admin exactly.
//
// SECURITY: localStorage is readable by any JS on the page (XSS vector).
// Memory-only storage means the token is lost on reload — intentional. The
// httpOnly refresh cookie (opaque to JS) re-authenticates silently via
// POST /auth-refresh on every page load.
//
// Token mechanics live here; buyer identity lives in AuthProvider.

import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  isRefreshing: boolean;
  isInitializing: boolean;

  setToken: (token: string, expiresIn: number) => void;
  clearToken: () => void;
  clearAll: () => void;
  setRefreshing: (value: boolean) => void;
  setInitialized: () => void;

  isAuthenticated: () => boolean;
  isExpiringSoon: (withinSeconds?: number) => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: null,
  expiresAt: null,
  isRefreshing: false,
  isInitializing: true,

  setToken: (token, expiresIn) =>
    set({
      accessToken: token,
      expiresAt: Date.now() + expiresIn * 1_000,
      isRefreshing: false,
    }),

  clearToken: () => set({ accessToken: null, expiresAt: null }),

  clearAll: () =>
    set({
      accessToken: null,
      expiresAt: null,
      isRefreshing: false,
    }),

  setRefreshing: (value) => set({ isRefreshing: value }),

  setInitialized: () => set({ isInitializing: false }),

  isAuthenticated: () => {
    const { accessToken, expiresAt } = get();
    if (!accessToken || !expiresAt) return false;
    return Date.now() < expiresAt - 30_000;
  },

  isExpiringSoon: (withinSeconds = 100) => {
    const { accessToken, expiresAt } = get();
    if (!accessToken || !expiresAt) return false;
    return Date.now() >= expiresAt - withinSeconds * 1_000;
  },
}));
