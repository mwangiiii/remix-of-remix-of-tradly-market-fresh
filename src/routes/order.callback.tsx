// Paystack callback landing (Household Commerce spec §8.2, plan E-frontend-submit).
//
// Paystack redirects the buyer here after they complete or cancel payment,
// appending `?reference=X&trxref=X` to the URL. We look up the order by
// paystack_reference and forward to /order/{id}. The order page's own poll
// handles the "webhook hasn't arrived yet" state (spec §8.2 "never trust
// the client callback — only the server-to-server webhook moves an order
// to paid").
//
// Renders a short spinner while the lookup + navigate happens.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, AlertTriangle } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { getConsumerOrderByReference } from "../marketplace/api/consumerOrders";

const searchSchema = z.object({
  reference: z.string().optional(),
  trxref: z.string().optional(),
});

export const Route = createFileRoute("/order/callback")({
  head: () => ({
    meta: [
      { title: "Confirming your payment — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: OrderCallback,
});

function OrderCallback() {
  const navigate = useNavigate();
  const { reference, trxref } = Route.useSearch();
  const ref = (reference ?? trxref ?? "").trim();

  const [state, setState] = useState<"working" | "not_found" | "no_ref">(
    ref ? "working" : "no_ref",
  );

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    (async () => {
      try {
        const order = await getConsumerOrderByReference(ref);
        if (cancelled) return;
        if (order) {
          // Straight to the detail page — its own poll waits on the webhook.
          navigate({ to: "/order/$id", params: { id: order.id }, replace: true });
        } else {
          setState("not_found");
        }
      } catch (err) {
        console.error("[order-callback] lookup failed:", err);
        if (!cancelled) setState("not_found");
      }
    })();
    return () => { cancelled = true; };
  }, [ref, navigate]);

  return (
    <AppShell hideNav variant="focused">
      <div className="px-4 pt-14 pb-24">
        <TrustHeader title="Payment" back="/orders" />
        <div className="mx-auto mt-6 max-w-sm text-center">
          {state === "working" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-trust" />
              <p className="mt-4 text-[15px] font-semibold text-ink">Confirming your payment…</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Taking you to your order.
              </p>
            </>
          )}
          {state === "no_ref" && (
            <>
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
              <p className="mt-4 text-[15px] font-semibold text-ink">No payment reference.</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Open your order from the orders page.
              </p>
            </>
          )}
          {state === "not_found" && (
            <>
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
              <p className="mt-4 text-[15px] font-semibold text-ink">We couldn't find that order.</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                If Paystack showed a successful payment, check your orders in a moment —
                the webhook may still be arriving.
              </p>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
