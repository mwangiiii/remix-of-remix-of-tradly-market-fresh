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

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Mail } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "../marketplace/lib/friendlyError";

/**
 * Parse the URL hash fragment Supabase uses to signal auth errors. Format:
 *   #error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
 * We handle this BEFORE calling completeMagicLink so a friendly, specific
 * message shows up instead of Supabase's raw error text.
 */
function parseHashError(hash: string): { code: string | null; description: string | null } {
  if (!hash || hash.length < 2) return { code: null, description: null };
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.get("error")) return { code: null, description: null };
  return {
    code: params.get("error_code"),
    description: params.get("error_description")?.replace(/\+/g, " ") ?? null,
  };
}

/** Translate Supabase auth error codes into plain-English messages. */
function messageForHashError(code: string | null, description: string | null): string {
  switch (code) {
    case "otp_expired":
      return "This sign-in link has expired. Links only work for 15 minutes — please request a new one.";
    case "otp_disabled":
      return "This sign-in link has already been used. For your safety, each link only works once.";
    case "access_denied":
      return "This sign-in link is no longer valid. Please request a fresh one.";
    default:
      return description
        ? friendlyError(description, "This sign-in link didn't work. Please request a new one.")
        : "This sign-in link didn't work. Please request a new one.";
  }
}

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

    // Supabase can signal errors via the URL fragment BEFORE any token
    // exchange (e.g. otp_expired, otp_disabled, access_denied). Catch those
    // first and surface a specific message — otherwise completeMagicLink()
    // would fail with an opaque "no session" error.
    const hashErr =
      typeof window !== "undefined" ? parseHashError(window.location.hash) : { code: null, description: null };
    if (hashErr.code || hashErr.description) {
      setErrorMessage(messageForHashError(hashErr.code, hashErr.description));
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const result = await completeMagicLink();
        toast.success(result.new ? "Account created" : "Signed in");
        navigate({ to: next ?? "/account" });
      } catch (err) {
        setErrorMessage(friendlyError(err, "This sign-in link didn't work. Please request a new one."));
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
          <div className="mx-auto max-w-sm flex flex-col items-center gap-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-ripe/12 text-ripe" aria-hidden>
              <AlertTriangle className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink lg:text-[19px]">
                That link didn't work
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                {errorMessage ?? "The link may have expired or already been used."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-background shadow-sm hover:bg-ink/90"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Send a new link
            </button>
            <Link
              to="/"
              className="text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              Continue browsing without signing in
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
