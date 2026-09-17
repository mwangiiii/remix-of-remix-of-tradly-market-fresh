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
    // Convenience flag consumed by TopNav + /account to surface the /admin
    // entry point. Keeping the role string check in one place so any future
    // role rename (e.g. platform_super_admin → platform_admin) only touches
    // this file plus RequireAdmin.
    isPlatformSuperAdmin: ctx.isAuthenticated && ctx.buyer?.role === "platform_super_admin",
    login: ctx.login,
    signup: ctx.signup,
    logout: ctx.logout,
    // Magic link (spec §8 individual buyer flow, wired 2026-08-02 —
    // replaces the earlier phone OTP approach; strict decision by product).
    sendMagicLink: ctx.sendMagicLink,
    completeMagicLink: ctx.completeMagicLink,
  };
}
