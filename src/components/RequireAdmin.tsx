// Route gate for /admin/*. Only platform_super_admin JWTs are let through.
// Anonymous or business-role sessions are bounced to /login with a next hint.
//
// The gate is a runtime UI wrapper, not a router beforeLoad. That's deliberate
// so it Just Works with SSR / hydration — server render always shows "checking
// session", client mount runs the silent refresh, and either lets you in or
// redirects. No infinite-refresh loops, no cookie plumbing at load time.

import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert } from "lucide-react";

const REQUIRED_ROLE = "platform_super_admin";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { isInitializing, isAuthenticated, buyer } = useAuth();

  const isAdmin = isAuthenticated && buyer?.role === REQUIRED_ROLE;

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate({ to: "/login", search: { next: "/admin" } });
    }
  }, [isInitializing, isAuthenticated, navigate]);

  if (isInitializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-ink-muted">
        <p className="text-sm">Checking your session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // useEffect will navigate; keep the surface calm in the meantime.
    return (
      <div className="grid min-h-screen place-items-center bg-background text-ink-muted">
        <p className="text-sm">Redirecting to sign-in…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md rounded-3xl border border-divider bg-surface p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">Admin access required</h1>
          <p className="mt-2 text-sm text-ink-muted">
            You're signed in, but this workspace is for the Tradly platform team only.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
