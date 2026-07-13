// Thin adapter over AuthContext. Consumers should import from here so future
// context refactors don't ripple.

import { useAuthContext } from "@/contexts/AuthContext";

export function useAuth() {
  const ctx = useAuthContext();
  return {
    isAuthenticated: ctx.isAuthenticated,
    isInitializing: ctx.isInitializing,
    isLoading: ctx.isLoading,
    error: ctx.error,
    buyer: ctx.buyer,
    login: ctx.login,
    signup: ctx.signup,
    logout: ctx.logout,
  };
}
