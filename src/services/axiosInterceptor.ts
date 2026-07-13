// Wires request auth injection + the 401 silent-refresh-with-queue strategy onto
// an Axios instance. Mirrors tradly-flow / tradly-super-admin.
//
//  Normal request:  REQUEST interceptor attaches Authorization: Bearer <token>.
//  401 mid-flight:   RESPONSE interceptor refreshes once (queueing concurrent
//                    401s), replays the original request; on refresh failure it
//                    force-logs-out — EXCEPT for anonymous requests, where a 401
//                    on refresh just means "no session, stay anonymous".

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/store/useAuthStore";
import {
  forceLogout,
  forceLogoutExpired,
  forceLogoutRevoked,
  forceLogoutNetwork,
} from "@/services/force-logout";

export interface NormalisedError {
  code: string;
  message: string;
  status: number | null;
  details?: unknown;
}

type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

const refreshQueue: QueueItem[] = [];

function drainQueue(newToken: string): void {
  while (refreshQueue.length > 0) refreshQueue.shift()!.resolve(newToken);
}

function rejectQueue(error: unknown): void {
  while (refreshQueue.length > 0) refreshQueue.shift()!.reject(error);
}

export function normaliseError(error: unknown): NormalisedError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const body = error.response?.data as { code?: string; message?: string } | undefined;
    return {
      code: body?.code ?? (status ? `HTTP_${status}` : "NETWORK_ERROR"),
      message: body?.message ?? error.message ?? "An unexpected error occurred",
      status,
      details: body,
    };
  }
  if (error instanceof Error) {
    return { code: "CLIENT_ERROR", message: error.message, status: null };
  }
  return { code: "UNKNOWN_ERROR", message: "An unexpected error occurred", status: null };
}

let proactiveRefreshInFlight = false;

async function proactiveRefresh(functionsBase: string): Promise<void> {
  const authStore = useAuthStore.getState();
  if (proactiveRefreshInFlight || authStore.isRefreshing) return;

  proactiveRefreshInFlight = true;
  authStore.setRefreshing(true);

  try {
    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      `${functionsBase}/auth-refresh`,
      {},
      { withCredentials: true, timeout: 15_000 },
    );
    useAuthStore.getState().setToken(data.access_token, data.expires_in);
  } catch {
    // Swallow — anonymous or expiring, the 401 response interceptor is the safety net.
  } finally {
    proactiveRefreshInFlight = false;
    useAuthStore.getState().setRefreshing(false);
  }
}

export function attachInterceptors(instance: AxiosInstance, functionsBase: string): void {
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
      const authStore = useAuthStore.getState();
      const token = authStore.accessToken;

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const isAuthEndpoint =
        config.url?.includes("/auth-refresh") || config.url?.includes("/auth-login");

      if (
        authStore.isExpiringSoon(100) &&
        !authStore.isRefreshing &&
        !proactiveRefreshInFlight &&
        !isAuthEndpoint
      ) {
        proactiveRefresh(functionsBase).catch(() => {});
      }

      return config;
    },
    (error: AxiosError) => Promise.reject(normaliseError(error)),
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,

    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retried?: boolean;
      };

      const status = error.response?.status;
      const body = error.response?.data as { code?: string; message?: string } | undefined;
      const code = body?.code ?? "";

      if (status !== 401) return Promise.reject(normaliseError(error));
      if (originalRequest._retried) return Promise.reject(normaliseError(error));

      // 401 from the refresh endpoint itself → unrecoverable when we had a session.
      // If the caller was anonymous (no token in memory), silently stay anonymous.
      if (originalRequest.url?.includes("/auth-refresh")) {
        const hadToken = !!useAuthStore.getState().accessToken;
        if (!hadToken) return Promise.reject(normaliseError(error));
        if (code === "AUTH_006") forceLogoutExpired("Refresh endpoint → AUTH_006");
        else if (code === "AUTH_005") forceLogoutRevoked("Refresh endpoint → AUTH_005");
        else forceLogout("AUTH_006", `Refresh endpoint 401 — code: ${code}`);
        return Promise.reject(normaliseError(error));
      }

      // 401 from /auth-login → let the login page surface it
      if (originalRequest.url?.includes("/auth-login")) {
        return Promise.reject(normaliseError(error));
      }

      const authStore = useAuthStore.getState();

      if (authStore.isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          refreshQueue.push({
            resolve: (newToken: string) => {
              originalRequest._retried = true;
              originalRequest.headers!.Authorization = `Bearer ${newToken}`;
              resolve(instance(originalRequest));
            },
            reject: (err: unknown) => reject(normaliseError(err as AxiosError)),
          });
        });
      }

      authStore.setRefreshing(true);
      originalRequest._retried = true;

      try {
        const { data } = await axios.post<{ access_token: string; expires_in: number }>(
          `${functionsBase}/auth-refresh`,
          {},
          { withCredentials: true, timeout: 15_000 },
        );

        const { access_token, expires_in } = data;
        authStore.setToken(access_token, expires_in);
        drainQueue(access_token);

        originalRequest.headers!.Authorization = `Bearer ${access_token}`;
        return instance(originalRequest);
      } catch (refreshError) {
        const normRefresh = normaliseError(refreshError);
        rejectQueue(refreshError);

        if (normRefresh.code === "AUTH_005") forceLogoutRevoked("Refresh failed — AUTH_005");
        else if (normRefresh.code === "AUTH_006") forceLogoutExpired("Refresh failed — AUTH_006");
        else if (normRefresh.status === null) forceLogoutNetwork("No response from refresh endpoint");
        else forceLogout("DEFAULT", `Refresh failed — code: ${normRefresh.code}`);

        return Promise.reject(normRefresh);
      } finally {
        useAuthStore.getState().setRefreshing(false);
        proactiveRefreshInFlight = false;
      }
    },
  );
}
