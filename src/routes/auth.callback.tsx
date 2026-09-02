// src/routes/auth.callback.tsx
//
// Magic-link redirect handler (spec §8 individual buyer signup).
//
// Supabase sends users here after they click the SMS-free / password-free
// sign-in link. On mount we:
//   1) Parse the URL hash for access_token + refresh_token
//   2) Set the Supabase session in memory
//   3) Provision an individual workspace if this is a first-time sign-in
//   4) Refresh the JWT so it carries business_id
//   5) Navigate to /account (or the ?next= route)
//
// All of the above lives in AuthProvider.completeMagicLink() — this route
// is just the trigger + a friendly loading/error surface.

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing you in — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth/callback" });
  const { completeMagicLink } = useAuth();

  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in dev; guard with a ref so
    // we only consume the redirect once (setSession is destructive of the URL).
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const result = await completeMagicLink();
        toast.success(result.new ? "Account created" : "Signed in");
        navigate({ to: next ?? "/account" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setErrorMessage(message);
        setStatus("error");
      }
    })();
  }, [completeMagicLink, navigate, next]);

  return (
    <AppShell hideNav>
      <div className="px-4 pt-16 pb-24">
        {status === "working" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-trust" aria-hidden />
            <p className="text-[14px] font-semibold text-ink">Signing you in…</p>
            <p className="text-[12.5px] text-ink-muted max-w-xs">
              Confirming your email and setting up your account.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mx-auto max-w-sm flex flex-col items-center gap-3 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[15px] font-semibold text-ink">Sign-in link didn't work</p>
            <p className="text-[12.5px] text-ink-muted">
              {errorMessage ?? "The link may have expired or already been used."}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="mt-2 rounded-full bg-trust px-5 py-2.5 text-[13px] font-semibold text-trust-foreground"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
