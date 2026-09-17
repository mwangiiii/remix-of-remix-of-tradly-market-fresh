import type { ConsumerOrderStatus, TenantOrderStatus } from "../types/marketplace";

// One config covers both order-status enums (all keys distinct). The badge
// accepts either union — the component doesn't need to know which pipeline
// produced the row.
const config: Record<
  TenantOrderStatus | ConsumerOrderStatus,
  { label: string; className: string }
> = {
  // Tenant / purchase_request lifecycle
  draft:              { label: "Draft",             className: "bg-muted text-ink-muted" },
  pending_approval:   { label: "Pending Approval",  className: "bg-ripe/15 text-[oklch(0.42_0.11_65)]" },
  approved:           { label: "Approved",          className: "bg-trust/15 text-trust-deep" },
  po_generated:       { label: "PO Generated",      className: "bg-trust/15 text-trust-deep" },
  invoiced:           { label: "Invoiced",          className: "bg-trust/15 text-trust-deep" },

  // Shared: delivered + paid + cancelled appear in both pipelines with the
  // same semantics. Consumer statuses that only exist here:
  pending_payment:    { label: "Awaiting Payment",  className: "bg-ripe/15 text-[oklch(0.42_0.11_65)]" },
  picking:            { label: "Picking",           className: "bg-trust/15 text-trust-deep" },
  dispatched:         { label: "Out for Delivery",  className: "bg-trust/15 text-trust-deep" },
  expired:            { label: "Expired",           className: "bg-muted text-ink-muted" },

  // Shared terminal states
  delivered:          { label: "Delivered",         className: "bg-farm/12 text-farm" },
  paid:               { label: "Paid",              className: "bg-farm/15 text-farm" },
  cancelled:          { label: "Cancelled",         className: "bg-destructive/12 text-destructive" },
};

export function StatusBadge({
  status,
}: {
  status: TenantOrderStatus | ConsumerOrderStatus;
}) {
  const c = config[status];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.className}`}>
      {c.label}
    </span>
  );
}
