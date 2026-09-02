// Buyer-side session manager. Same mechanism as tradly-flow / tradly-super-admin:
//   - in-memory access token (useAuthStore) + httpOnly refresh cookie
//   - silent refresh on mount (restore session from the cookie)
//   - proactive + background refresh to keep the token fresh
//
// Difference from super-admin: NO role gate. Any authenticated buyer signs in.
// Anonymous is also a first-class state — a failed silent refresh isn't an error,
// it just means "not signed in yet".

import {
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AuthContext,
  type AuthContextType,
  type AuthError,
  type Buyer,
  type SignupInput,
} from "./AuthContext";
import { useAuthStore } from "@/store/useAuthStore";
import { api } from "@/services/api";
import { getSupabase } from "@/lib/supabase";

const JUST_LOGGED_OUT = "__tradly_market_just_logged_out";
const LOGOUT_REASON = "__tradly_market_logout_reason";

// Magic-link (Sub 27) refresh token storage (Sub 29 long-lived session,
// Sub 31 upgraded to httpOnly cookie).
//
// The refresh_token now lives in the `tradly_market_refresh` httpOnly
// cookie set by `/api/session/store` — invisible to JS, so XSS cannot
// exfil it. All operations go through TanStack Start server routes:
//
//   POST /api/session/store    — stash refresh_token in the cookie
//   POST /api/session/refresh  — refresh + rotate the cookie
//   POST /api/session/clear    — expire the cookie on logout
//
// The one-time localStorage migration below runs once on module load to
// evict any stray refresh_token from browsers that visited during the
// Sub 29 window. Safe to remove after a few weeks.
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem("__tradly_market_magic_refresh"); } catch { /* ignore */ }
}

async function storeMagicRefresh(refreshToken: string): Promise<void> {
  try {
    await fetch("/api/session/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      credentials: "same-origin",
    });
  } catch { /* network hiccup — session works this tab, dies on reload */ }
}

type SessionRefreshResult = { access_token: string; expires_in: number } | null;
async function refreshFromCookie(): Promise<SessionRefreshResult> {
  try {
    const res = await fetch("/api/session/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return (await res.json()) as { access_token: string; expires_in: number };
  } catch {
    return null;
  }
}

async function clearMagicRefreshCookie(): Promise<void> {
  try {
    await fetch("/api/session/clear", { method: "POST", credentials: "same-origin" });
  } catch { /* ignore */ }
}

const HARD_LOGOUT_CODES: Record<string, true> = {
  AUTH_003: true,
  AUTH_004: true,
  AUTH_005: true,
  AUTH_006: true,
};

function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch {
    return null;
  }
}

function roleFromClaims(claims: Record<string, unknown>): string {
  return (claims.app_role ?? claims.role ?? claims.user_role ?? "authenticated") as string;
}

function buyerFromClaims(claims: Record<string, unknown>, fallback?: Partial<Buyer>): Buyer {
  return {
    id: (claims.sub as string) ?? fallback?.id ?? "",
    email: (claims.email as string) ?? fallback?.email ?? "",
    fullName: (claims.name as string) ?? fallback?.fullName,
    businessId: (claims.business_id as string) ?? fallback?.businessId ?? null,
    role: roleFromClaims(claims),
  };
}

function mapErrorToAuthError(err: unknown): AuthError {
  const e = err as {
    response?: { data?: { code?: string; message?: string } };
    code?: string;
    message?: string;
  };
  const code = e.response?.data?.code || e.code || "UNKNOWN";
  const message = e.response?.data?.message || e.message || "Authentication failed";
  const isRecoverable = !HARD_LOGOUT_CODES[code];
  return { code, message, isRecoverable };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // SSR-safe defaults: we haven't tried to restore yet, treat as initializing.
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const isAuthenticated =
    !!accessToken && (expiresAt ? expiresAt > Date.now() : false) && !!buyer;

  const setTokens = useCallback((token: string, expiresIn: number) => {
    useAuthStore.getState().setToken(token, expiresIn);
    setAccessToken(token);
    setExpiresAt(Date.now() + expiresIn * 1000);
  }, []);

  const clearAuthState = useCallback(() => {
    setAccessToken(null);
    setExpiresAt(null);
    setBuyer(null);
    setError(null);
    useAuthStore.getState().clearAll();
  }, []);

  // ── silent refresh (bootstrap) ──────────────────────────────────────────
  //
  // Two paths are tried in order:
  //   1. Magic-link refresh (Sub 31) — POST /api/session/refresh, which
  //      reads the `tradly_market_refresh` httpOnly cookie server-side and
  //      calls Supabase. Rotates the cookie on success.
  //   2. Email/password refresh — POST /auth-refresh which reads the
  //      Tradly-refresh httpOnly cookie set by /auth-login.
  // If both fail: anonymous.
  const silentRefresh = useCallback(async () => {
    try {
      setIsInitializing(true);

      if (typeof window !== "undefined" && sessionStorage.getItem(JUST_LOGGED_OUT)) {
        sessionStorage.removeItem(JUST_LOGGED_OUT);
        await clearMagicRefreshCookie();
        clearAuthState();
        return;
      }

      // Path 1: magic-link refresh via server cookie route (Sub 31)
      const cookieRefresh = await refreshFromCookie();
      if (cookieRefresh) {
        setTokens(cookieRefresh.access_token, cookieRefresh.expires_in);
        const claims = decodeJWT(cookieRefresh.access_token) ?? {};
        setBuyer(buyerFromClaims(claims));
        setError(null);
        return;
      }

      // Path 2: email/password refresh via /auth-refresh cookie
      if (!api.defaults.baseURL) {
        clearAuthState();
        return;
      }
      const response = await api.post("/auth-refresh", {});
      const { access_token, expires_in } = response.data as {
        access_token: string;
        expires_in: number;
      };
      if (!access_token) throw new Error("No token in refresh response");

      const claims = decodeJWT(access_token);
      if (!claims) throw new Error("Could not decode JWT");

      setTokens(access_token, expires_in);
      setBuyer(buyerFromClaims(claims));
      setError(null);
    } catch {
      // Anonymous is fine. Clear anything half-set; don't surface an error.
      clearAuthState();
    } finally {
      setIsInitializing(false);
      useAuthStore.getState().setInitialized();
    }
  }, [clearAuthState, setTokens]);

  // ── login ───────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.post("/auth-login", { email, password });
        const { access_token, expires_in, user } = response.data as {
          access_token: string;
          expires_in: number;
          user: {
            id: string;
            name?: string;
            email: string;
            role: string;
            business_id?: string | null;
          };
        };

        if (!access_token) throw new Error("Login response missing access_token");

        // Decode claims to sync businessId + role authoritatively (server user
        // payload is a hint; the JWT is the truth).
        const claims = decodeJWT(access_token) ?? {};

        setTokens(access_token, expires_in);
        setBuyer(
          buyerFromClaims(claims, {
            id: user.id,
            email: user.email,
            fullName: user.name,
            businessId: user.business_id ?? null,
          }),
        );
      } catch (err) {
        const authErr = mapErrorToAuthError(err);
        setError(authErr);
        throw authErr;
      } finally {
        setIsLoading(false);
      }
    },
    [setTokens],
  );

  // ── signup ──────────────────────────────────────────────────────────────
  const signup = useCallback(
    async (input: SignupInput) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.post("/marketplace-signup", {
          email: input.email,
          password: input.password,
          company_name: input.companyName,
          phone: input.phone,
          kra_pin: input.kraPin,
          industry: input.industry,
          size: input.size,
        });
        const { access_token, expires_in, user } = response.data as {
          access_token: string;
          expires_in: number;
          user: {
            id: string;
            name?: string;
            email: string;
            role: string;
            business_id?: string | null;
          };
        };
        if (!access_token) throw new Error("Signup response missing access_token");

        const claims = decodeJWT(access_token) ?? {};
        setTokens(access_token, expires_in);
        setBuyer(
          buyerFromClaims(claims, {
            id: user.id,
            email: user.email,
            fullName: user.name,
            businessId: user.business_id ?? null,
          }),
        );
      } catch (err) {
        const authErr = mapErrorToAuthError(err);
        setError(authErr);
        throw authErr;
      } finally {
        setIsLoading(false);
      }
    },
    [setTokens],
  );

  // ── Magic link: send ────────────────────────────────────────────────────
  // Individual buyer signup (spec §8) via email magic link — no password,
  // no OTP typing, no Twilio dependency. Supabase Auth sends the email via
  // its built-in SMTP (or your configured provider).
  //
  // `name` is stashed in user_metadata so the /auth/callback route can pick
  // it up when provisioning the workspace. `shouldCreateUser: true` allows
  // signup from a fresh email — for a returning user with an existing
  // auth.users row this just sends a passwordless sign-in link.
  const sendMagicLink = useCallback(async (email: string, name: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const siteUrl = import.meta.env.VITE_SITE_URL ?? window.location.origin;
      const { error: sendErr } = await getSupabase().auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
          shouldCreateUser: true,
          data: { name },
        },
      });
      if (sendErr) throw sendErr;
    } catch (err) {
      const authErr = mapErrorToAuthError(err);
      setError(authErr);
      throw authErr;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Magic link: consume redirect + provision ────────────────────────────
  // Called by /auth/callback on mount. Sequence:
  //   1. Parse the URL hash fragment (Supabase's default magic-link format)
  //      for access_token + refresh_token.
  //   2. supabase.auth.setSession — puts the session in the in-memory
  //      Supabase client so subsequent .rpc/.auth calls carry auth.
  //   3. Stash the token in our own useAuthStore so getSupabase()'s fetch
  //      override attaches Authorization to PostgREST calls.
  //   4. Check the decoded JWT for a business_id claim. If missing (new
  //      user), call the atomic provisioning RPC using name from
  //      user_metadata (set by sendMagicLink).
  //   5. If we provisioned, refresh the session so custom_access_token_hook
  //      mints a JWT with the new business_id claim.
  //   6. Populate buyer state.
  //
  // No Tradly-refresh cookie is set — magic-link sessions live for the
  // Supabase JWT TTL (~1h). Users click a fresh link on expiry.
  const completeMagicLink = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabase();

      // 1. Parse the hash fragment
      const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      const params = new URLSearchParams(hash);
      const access_token  = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) {
        throw new Error("No session tokens in redirect URL — the link may have expired.");
      }

      // 2. Set the session in the Supabase client
      const { data: sessionData, error: setErr } = await supabase.auth.setSession({
        access_token, refresh_token,
      });
      if (setErr) throw setErr;
      if (!sessionData.session) throw new Error("setSession returned no session");

      // 3. Stash the token for PostgREST calls
      setTokens(sessionData.session.access_token, sessionData.session.expires_in ?? 3600);

      // Clear the hash so a page reload doesn't re-consume
      if (typeof window !== "undefined" && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      // 4. Decide: provision or skip?
      const initialClaims = decodeJWT(sessionData.session.access_token) ?? {};
      const alreadyProvisioned = !!(initialClaims.business_id as string | undefined);

      let rpcOut: { business_id?: string; new?: boolean } | null = null;
      let finalAccessToken  = sessionData.session.access_token;
      let finalExpiresIn    = sessionData.session.expires_in ?? 3600;
      let finalRefreshToken = sessionData.session.refresh_token;

      if (!alreadyProvisioned) {
        const userMetaName = (sessionData.session.user.user_metadata?.name as string | undefined) ?? "";
        const emailFromSession = sessionData.session.user.email ?? null;
        if (!emailFromSession) {
          throw new Error("Session has no email — cannot provision individual workspace.");
        }

        // Provision. RPC's auth.uid()=p_owner.id self-guard passes.
        const { data, error: rpcErr } = await supabase.rpc(
          "rpc_create_individual_workspace_atomic",
          {
            p_name: userMetaName || emailFromSession.split("@")[0] || "Individual",
            p_phone: sessionData.session.user.phone || `email-${sessionData.session.user.id}`,
            p_email: emailFromSession,
            p_owner: {
              id: sessionData.session.user.id,
              email: emailFromSession,
              name: userMetaName || emailFromSession,
            },
          },
        );
        if (rpcErr) throw rpcErr;
        rpcOut = data as { business_id?: string; new?: boolean };

        // 5. Refresh session so JWT carries business_id claim
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession({
          refresh_token: sessionData.session.refresh_token,
        });
        if (refreshErr) throw refreshErr;
        if (refreshed.session) {
          finalAccessToken = refreshed.session.access_token;
          finalExpiresIn   = refreshed.session.expires_in ?? 3600;
          finalRefreshToken = refreshed.session.refresh_token;
          setTokens(finalAccessToken, finalExpiresIn);
        }
      }

      // 6. Populate buyer state
      const finalClaims = decodeJWT(finalAccessToken) ?? {};
      setBuyer(
        buyerFromClaims(finalClaims, {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email ?? undefined,
          fullName: (sessionData.session.user.user_metadata?.name as string | undefined) ?? undefined,
          businessId: (rpcOut?.business_id) ?? (finalClaims.business_id as string | undefined) ?? null,
        }),
      );

      // 7. Persist refresh_token for long-lived sessions (Sub 31 — httpOnly
      //    cookie via server route). Reload (page close/open) will rehydrate
      //    via silentRefresh path 1.
      await storeMagicRefresh(finalRefreshToken);

      return {
        business_id: rpcOut?.business_id ?? (finalClaims.business_id as string | undefined) ?? null,
        new: rpcOut?.new ?? false,
      };
    } catch (err) {
      const authErr = mapErrorToAuthError(err);
      setError(authErr);
      throw authErr;
    } finally {
      setIsLoading(false);
    }
  }, [setTokens]);

  // ── logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(
    async (reason = "user_requested") => {
      try {
        setIsLoading(true);
        // Also revoke the Supabase-side session for magic-link users so the
        // stored refresh_token becomes unusable immediately. Clearing the
        // cookie in parallel — either succeeding is enough.
        await Promise.allSettled([
          clearMagicRefreshCookie(),
          getSupabase().auth.signOut(),
        ]);
        clearAuthState();
        queryClient.clear();
        if (typeof window !== "undefined") {
          sessionStorage.setItem(JUST_LOGGED_OUT, "true");
          if (reason !== "user_requested") {
            sessionStorage.setItem(LOGOUT_REASON, reason);
          }
          setTimeout(() => {
            window.location.href = "/";
          }, 100);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [clearAuthState, queryClient],
  );

  // ── bootstrap once (client-only) ────────────────────────────────────────
  useEffect(() => {
    silentRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── background + focus refresh ──────────────────────────────────────────
  // Try the magic-link cookie route first (Sub 31). Fall back to
  // /auth-refresh for email/password buyers. Interceptor's force-logout
  // handles hard failures.
  const refreshSilently = useCallback(async () => {
    const cookieRefresh = await refreshFromCookie();
    if (cookieRefresh) {
      const claims = decodeJWT(cookieRefresh.access_token);
      if (!claims) return;
      setTokens(cookieRefresh.access_token, cookieRefresh.expires_in);
      setBuyer((prev) => (prev ? { ...prev, ...buyerFromClaims(claims, prev) } : buyerFromClaims(claims)));
      return;
    }
    if (!api.defaults.baseURL) return;
    try {
      const response = await api.post("/auth-refresh", {});
      const { access_token, expires_in } = response.data as {
        access_token: string;
        expires_in: number;
      };
      const claims = access_token ? decodeJWT(access_token) : null;
      if (!claims) return;
      setTokens(access_token, expires_in);
      setBuyer((prev) => (prev ? { ...prev, ...buyerFromClaims(claims, prev) } : buyerFromClaims(claims)));
    } catch {
      // The interceptor's force-logout handles hard failures.
    }
  }, [setTokens]);

  useEffect(() => {
    if (!isAuthenticated || !expiresAt) return;
    const interval = setInterval(() => {
      const inSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
      if (inSeconds > 0 && inSeconds < 300) refreshSilently();
    }, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, expiresAt, refreshSilently]);

  useEffect(() => {
    const onFocus = () => {
      if (!isAuthenticated || !expiresAt) return;
      if (Math.ceil((expiresAt - Date.now()) / 1000) < 300) refreshSilently();
    };
    if (typeof window === "undefined") return;
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAuthenticated, expiresAt, refreshSilently]);

  const value: AuthContextType = {
    isAuthenticated,
    isInitializing,
    isLoading,
    error,
    buyer,
    accessToken,
    expiresAt,
    login,
    signup,
    logout,
    sendMagicLink,
    completeMagicLink,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
