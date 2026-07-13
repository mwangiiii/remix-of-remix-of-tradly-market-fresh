// Auth context for the market app. Trimmed to what a buyer surface needs.
//
// Anonymous browsing is a first-class state: `isAuthenticated: false` +
// `isInitializing: false` is a valid steady state, not an error. Login gates
// only the checkout / orders / saved-lists / notifications / account surfaces.

import { createContext, useContext } from "react";

export interface AuthError {
  code: string;
  message: string;
  isRecoverable: boolean;
}

export interface Buyer {
  id: string;
  email: string;
  fullName?: string;
  businessId: string | null;
  role: string;
}

export interface SignupInput {
  email: string;
  password: string;
  companyName: string;
  phone?: string;
  kraPin?: string;
  industry?: string;
  size?: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  /** True while the bootstrap silent refresh is in flight (SSR / first paint). */
  isInitializing: boolean;
  /** True while a login/refresh request is pending. */
  isLoading: boolean;
  error: AuthError | null;

  buyer: Buyer | null;
  accessToken: string | null;
  expiresAt: number | null;

  login(email: string, password: string): Promise<void>;
  signup(input: SignupInput): Promise<void>;
  logout(reason?: string): Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
