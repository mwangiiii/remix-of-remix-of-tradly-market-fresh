import type { OrderStatus } from "../types/marketplace";

const config: Record<OrderStatus, { label: string; className: string }> = {
  draft:              { label: "Draft",             className: "bg-muted text-ink-muted" },
  pending_approval:   { label: "Pending Approval",  className: "bg-ripe/15 text-[oklch(0.42_0.11_65)]" },
  approved:           { label: "Approved",          className: "bg-trust/15 text-trust-deep" },
  po_generated:       { label: "PO Generated",      className: "bg-trust/15 text-trust-deep" },
  delivered:          { label: "Delivered",         className: "bg-farm/12 text-farm" },
  invoiced:           { label: "Invoiced",          className: "bg-trust/15 text-trust-deep" },
  paid:               { label: "Paid",              className: "bg-farm/15 text-farm" },
  cancelled:          { label: "Cancelled",         className: "bg-destructive/12 text-destructive" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.className}`}>
      {c.label}
    </span>
  );
}
