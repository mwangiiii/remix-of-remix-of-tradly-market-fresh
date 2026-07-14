import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  MapPin, Receipt, Bell, LogOut, Building2, Mail, Phone,
  ChevronRight,
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
