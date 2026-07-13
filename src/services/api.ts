// Central Axios instance for market Edge Function calls. Mirrors
// tradly-flow / tradly-super-admin: in-memory Bearer token, httpOnly refresh
// cookie, 401 silent refresh. All interceptor logic lives in axiosInterceptor.ts.

import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { attachInterceptors } from "@/services/axiosInterceptor";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export const FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "";

function assertSupabaseUrl(): void {
  if (SUPABASE_URL) return;
  throw new Error(
    "[api.ts] VITE_SUPABASE_URL is not set. Add it to your Vercel project env vars (and .env locally):\n" +
      "  VITE_SUPABASE_URL=https://<project-ref>.supabase.co",
  );
}

export interface TradlyEnvelope<T> {
  data: T;
  error: string | null;
  meta?: Record<string, unknown>;
}

export const api: AxiosInstance = axios.create({
  baseURL: FUNCTIONS_BASE || undefined,
  timeout: 30_000,
  withCredentials: true, // sends the httpOnly refresh cookie
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

if (FUNCTIONS_BASE) {
  attachInterceptors(api, FUNCTIONS_BASE);
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  assertSupabaseUrl();
  const { data: envelope } = await api.get<TradlyEnvelope<T>>(path, { params, ...config });
  return envelope.data;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  assertSupabaseUrl();
  const { data: envelope } = await api.post<TradlyEnvelope<T>>(path, body, config);
  return envelope.data;
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  assertSupabaseUrl();
  const { data: envelope } = await api.patch<TradlyEnvelope<T>>(path, body, config);
  return envelope.data;
}

export async function apiDelete<T = void>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  assertSupabaseUrl();
  const { data: envelope } = await api.delete<TradlyEnvelope<T>>(path, config);
  return envelope.data;
}

export type { NormalisedError } from "@/services/axiosInterceptor";

export default api;
