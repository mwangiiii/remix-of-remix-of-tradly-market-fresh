import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useSessionStore, seedProfile } from "../marketplace/store/sessionStore";
import { Sparkles, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Account() {
  const state = useSessionStore((s) => s.profile);
  const isAuthed = useSessionStore((s) => s.isAuthenticated);
  const profile = state ?? seedProfile;

  return (
    <AppShell>
      <div className="px-4">
        <TrustHeader title="Account" back="/" />

        {!isAuthed && (
          <div className="mt-4 rounded-2xl border border-divider bg-surface p-4 text-center">
            <p className="text-[14px] text-ink">Sign in to see your live orders and team.</p>
            <Link to="/login" className="mt-3 inline-block rounded-full bg-trust px-4 py-2 text-[13px] font-semibold text-trust-foreground">
              Sign in
            </Link>
          </div>
        )}

        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Company</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{profile.companyName}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">KRA PIN · {profile.kraPin}</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">{profile.phone}</p>
          <span className="mt-3 inline-flex items-center rounded-full bg-trust/10 px-2.5 py-1 text-[11px] font-semibold text-trust-deep">
            {profile.plan === "marketplace_only" ? "Marketplace only" : "Full Tradly"}
          </span>
        </section>

        {profile.plan === "marketplace_only" && (
          <section className="mt-5 rounded-2xl bg-gradient-to-br from-trust-deep to-trust p-5 text-trust-deep-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-[12px] font-semibold uppercase tracking-wide">Upgrade</p>
            </div>
            <h3 className="mt-2 text-lg font-bold">Unlock full Tradly procurement</h3>
            <p className="mt-1 text-[13px] opacity-90">
              Multi-supplier price comparison, approval workflows, GRN, three-way match.
            </p>
            <button className="mt-4 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-trust-deep">
              Talk to Tradly
            </button>
          </section>
        )}

        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <div className="mb-3 flex items-center gap-2 text-ink-muted">
            <Users className="h-4 w-4" />
            <p className="text-[12px] font-semibold uppercase tracking-wide">Team</p>
          </div>
          <ul className="divide-y divide-divider">
            {profile.team.map((m) => (
              <li key={m.name} className="flex items-center justify-between py-3">
                <span className="text-[14px] font-semibold text-ink">{m.name}</span>
                <span className="text-[12px] text-ink-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <div className="mb-3 flex items-center gap-2 text-ink-muted">
            <MapPin className="h-4 w-4" />
            <p className="text-[12px] font-semibold uppercase tracking-wide">Delivery addresses</p>
          </div>
          <ul className="divide-y divide-divider">
            {profile.addresses.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-[14px] font-semibold text-ink">{a.label}</p>
                <p className="mt-0.5 text-[12px] text-ink-muted">{a.line}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Payment on file</p>
          <p className="mt-2 text-[14px] font-semibold text-ink">M-PESA Paybill</p>
          <p className="text-[12px] text-ink-muted">Business number configured with Tradly Finance</p>
        </section>

        <Link
          to="/admin"
          className="mt-5 flex items-center justify-between rounded-2xl border border-divider bg-surface p-5 hover:border-trust/40"
        >
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Tradly staff</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">Admin console</p>
            <p className="text-[12px] text-ink-muted">Catalog, categories, inventory and order fulfilment</p>
          </div>
          <span className="rounded-full bg-trust/10 px-3 py-1 text-[11px] font-semibold text-trust-deep">Open</span>
        </Link>

      </div>
    </AppShell>
  );
}
