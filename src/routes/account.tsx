import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";
import {
  MapPin, Receipt, Bell, LogOut, Building2, Mail, Phone,
  ChevronRight, Rocket, ArrowUpRight,
} from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { getMyBusiness, getOrders } from "../marketplace/api/marketplaceApi";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});

function Account() {
  const navigate = useNavigate();
  const { buyer, isAuthenticated, isInitializing, logout } = useAuth();

  // Anonymous users get pushed to /login with `?next=/account` so they
  // return here after signing in. Runs after the silent-refresh settles
  // so we don't flicker when the buyer is actually signed in.
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate({ to: "/login", search: { next: "/account" } });
    }
  }, [isInitializing, isAuthenticated, navigate]);

  const { data: business, isLoading: bizLoading } = useQuery({
    queryKey: ["me", "business"],
    queryFn: getMyBusiness,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    enabled: isAuthenticated,
  });

  if (isInitializing || !isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Account" back="/" />
          <p className="py-16 text-center text-sm text-ink-muted">
            Checking your session…
          </p>
        </div>
      </AppShell>
    );
  }

  const displayName = business?.name || buyer?.fullName || buyer?.email?.split("@")[0] || "You";
  const initials = (business?.name ?? buyer?.email ?? "?")
    .split(/\s+|@/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const openOrderCount = orders.filter(
    (o) => !["paid", "cancelled"].includes(o.status),
  ).length;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
    } catch {
      // logout still navigates; suppress noise
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <TrustHeader title="Account" back="/" />

        {/* Identity card */}
        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-trust/10 text-trust text-lg font-bold">
              {business?.logoUrl ? (
                <img src={business.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Signed in as
              </p>
              <h2 className="mt-0.5 truncate text-[18px] font-semibold text-ink">{displayName}</h2>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{buyer?.email}</p>
            </div>
          </div>
        </section>

        {/* Upgrade CTA (individual buyers only) — deep-links into tradly-flow's
            §9 graduation wizard. business.id doesn't change during upgrade so
            every order + delivery on this storefront survives.
            Sub 30: appends the current Supabase refresh_token as a URL
            FRAGMENT (`#h=...`) so flow can skip the login step. Fragment stays
            client-side (never in server logs / referrers). */}
        {business?.businessType === "individual" && (
          <UpgradeCTA />
        )}

        {/* Quick actions */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <QuickTile
            to="/orders"
            icon={Receipt}
            label="Your orders"
            hint={openOrderCount > 0 ? `${openOrderCount} in progress` : `${orders.length} total`}
          />
          <QuickTile
            to="/notifications"
            icon={Bell}
            label="Notifications"
          />
        </section>

        {/* Business details */}
        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <div className="mb-3 flex items-center gap-2 text-ink-muted">
            <Building2 className="h-4 w-4" />
            <p className="text-[12px] font-semibold uppercase tracking-wide">Business</p>
          </div>

          {bizLoading ? (
            <p className="py-3 text-[13px] text-ink-muted">Loading…</p>
          ) : business ? (
            <ul className="divide-y divide-divider">
              <Row label="Company" value={business.name} />
              {business.kraPin && <Row label="KRA PIN" value={business.kraPin} />}
              {business.email && (
                <Row
                  label={<><Mail className="inline h-3.5 w-3.5" /> Email</>}
                  value={business.email}
                />
              )}
              {business.phone && (
                <Row
                  label={<><Phone className="inline h-3.5 w-3.5" /> Phone</>}
                  value={business.phone}
                />
              )}
              {(business.address || business.city) && (
                <Row
                  label={<><MapPin className="inline h-3.5 w-3.5" /> Address</>}
                  value={[business.address, business.city].filter(Boolean).join(", ")}
                />
              )}
              {business.industry && <Row label="Industry" value={business.industry} />}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-ink-muted">
              We couldn't load your business details.
            </p>
          )}
        </section>

        {/* Compliance blurb */}
        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <div>
            <p className="text-[14px] font-semibold text-ink">Sourced by Tradly</p>
            <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-trust-deep">
              Corporate supply assurance
            </p>
          </div>
        </section>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-divider bg-surface px-4 py-3 text-[13px] font-semibold text-ink transition hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

// ─── UpgradeCTA (Sub 30 handoff-aware, Sub 31 cookie-sourced) ──────────
//
// Sub 22 was a plain <a href="…/upgrade">. Sub 30 added a short-lived
// handoff token in the URL fragment so tradly-flow can skip the login
// step. Sub 31 moves the token off localStorage (XSS-readable) onto an
// httpOnly cookie — the button now fetches the token from
// /api/session/handoff on click and navigates programmatically.
//
// Fallback: if the fetch 401s (email/password buyer, or session lost) we
// send the buyer to a plain /upgrade and they sign in on the flow side.
//
// URL fragment (not query string): fragments never appear in server logs,
// Referer headers, or analytics pipes. Same rationale Supabase uses for
// magic-link tokens.
function UpgradeCTA() {
  const flowUrl = import.meta.env.VITE_FLOW_URL ?? "https://app.tradly.co.ke";
  const [handingOff, setHandingOff] = React.useState(false);

  const onClick = React.useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (handingOff) return;
      setHandingOff(true);
      let url = `${flowUrl}/upgrade`;
      try {
        const res = await fetch("/api/session/handoff", { credentials: "same-origin" });
        if (res.ok) {
          const { refresh_token } = (await res.json()) as { refresh_token?: string };
          if (refresh_token) {
            const encoded = btoa(refresh_token).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            url = `${flowUrl}/upgrade#h=${encoded}`;
          }
        }
      } catch { /* fall through to non-handoff URL */ }
      window.location.href = url;
    },
    [flowUrl, handingOff],
  );

  return (
    <section className="mt-5 rounded-2xl border border-trust/30 bg-trust/[0.04] p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-trust/15 text-trust">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">Upgrade to a workspace</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Move from an individual buyer account to a company workspace. Unlocks POs,
            approvals, KRA-compliant invoicing, and lets you invite your team. Your
            order history stays with you.
          </p>
          <a
            href={`${flowUrl}/upgrade`}
            onClick={onClick}
            aria-disabled={handingOff}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-trust hover:underline aria-disabled:opacity-60"
          >
            {handingOff ? "Signing you in…" : "Start the upgrade"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
      <span className="flex items-center gap-1.5 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </li>
  );
}

function QuickTile({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: "/orders" | "/notifications";
  icon: typeof Receipt;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-divider bg-surface p-4 transition hover:border-trust/40"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-trust/10 text-trust">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{label}</p>
        {hint && <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">{hint}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-ink" />
    </Link>
  );
}
