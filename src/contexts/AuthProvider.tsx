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

const JUST_LOGGED_OUT = "__tradly_market_just_logged_out";
const LOGOUT_REASON = "__tradly_market_logout_reason";

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
  const silentRefresh = useCallback(async () => {
    try {
      setIsInitializing(true);

      if (typeof window !== "undefined" && sessionStorage.getItem(JUST_LOGGED_OUT)) {
        sessionStorage.removeItem(JUST_LOGGED_OUT);
        clearAuthState();
        return;
      }

      // No auth backend configured (VITE_SUPABASE_URL missing) — stay anonymous
      // instead of POSTing /auth-refresh against the app origin (which 500s).
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

  // ── logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(
    async (reason = "user_requested") => {
      try {
        setIsLoading(true);
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
  const refreshSilently = useCallback(async () => {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
