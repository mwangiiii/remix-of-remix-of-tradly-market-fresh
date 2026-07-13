// Terminates the current buyer session — called by the Axios interceptor when a
// token refresh fails or an unrecoverable auth error is detected.
//
// Mirrors tradly-flow / tradly-super-admin, minus the admin-store coupling.
// The market app tolerates anonymous browsing, so a hard logout drops to the
// home page (not /login) unless the caller wants to force the sign-in surface.

import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";

const LOGOUT_MESSAGES: Record<string, string> = {
  AUTH_005: "Your session was ended because you signed in on another device.",
  AUTH_006: "Your session has expired. Please sign in again to continue.",
  AUTH_003: "Your account has been deactivated. Contact support.",
  AUTH_004: "Your workspace has been suspended.",
  NETWORK: "Could not reach the authentication server. Please sign in again.",
  DEFAULT: "Your session ended. Please sign in again.",
};

export function forceLogout(
  errorCode = "DEFAULT",
  reason = "Unknown reason",
  immediate = false,
): void {
  const message = LOGOUT_MESSAGES[errorCode] ?? LOGOUT_MESSAGES.DEFAULT;

  console.warn(`[force-logout] code: ${errorCode} | reason: ${reason}`);

  useAuthStore.getState().clearAll();
  sessionStorage.setItem("__tradly_market_just_logged_out", "true");

  toast.error(message);

  const go = () => {
    // Drop to home rather than /login — the storefront is fully browsable
    // anonymously, and forcing /login on session expiry is more friction
    // than the average customer needs.
    window.location.href = "/";
  };

  if (immediate) go();
  else setTimeout(go, 350);
}

export const forceLogoutRevoked = (reason?: string) =>
  forceLogout("AUTH_005", reason ?? "Token revoked");
export const forceLogoutExpired = (reason?: string) =>
  forceLogout("AUTH_006", reason ?? "Refresh token expired");
export const forceLogoutNetwork = (reason?: string) =>
  forceLogout("NETWORK", reason ?? "Network error during refresh");
