import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { Check } from "lucide-react";

const searchSchema = z.object({ pr: z.string().optional() });

export const Route = createFileRoute("/order/$id/confirmation")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Order confirmed — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: OrderConfirmation,
});

const steps = ["Submitted", "Approved", "Delivered", "Invoiced"];

function OrderConfirmation() {
  const { pr = "PR-????" } = Route.useSearch();
  const { id } = Route.useParams();

  return (
    <AppShell hideNav>
      <div className="px-4 pb-8">
        <TrustHeader title="Order confirmed" back="/" />

        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-trust/12 text-trust">
            <Check className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">Order</p>
            <h1 className="mt-1 text-3xl font-bold text-ink">{pr}</h1>
            <p className="mt-2 text-[14px] text-ink-muted">submitted for approval</p>
          </div>
          <p className="max-w-xs text-[13px] text-ink-muted">
            Sourced from Tradly — Kenya's single-source supply chain. You'll be notified at each step.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-divider bg-surface p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Status</p>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                  i === 0 ? "bg-trust text-trust-foreground" : "bg-muted text-ink-muted"
                }`}>
                  {i === 0 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`text-[14px] ${i === 0 ? "font-semibold text-ink" : "text-ink-muted"}`}>
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/order/$id" params={{ id }}
            className="w-full rounded-full bg-trust px-5 py-3 text-center text-[14px] font-semibold text-trust-foreground"
          >
            View order
          </Link>
          <Link
            to="/"
            className="w-full rounded-full border border-divider bg-surface px-5 py-3 text-center text-[14px] font-semibold text-ink"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
