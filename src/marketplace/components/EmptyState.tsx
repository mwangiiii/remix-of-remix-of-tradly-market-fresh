import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared empty-state block. Optimised for non-technical + low-literacy users:
 * a friendly icon in a big rounded circle, one short sentence in plain
 * language, and one clear primary action rendered as a large tap-target
 * button. Optional secondary link for a softer fallback path.
 *
 * Use everywhere we currently render tiny grey "no items" text — orders,
 * lists, addresses, notifications, empty carts, search-no-results.
 */
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Kept intentionally short — one sentence, plain English. */
  description?: ReactNode;
  primary?: {
    label: string;
    /** Internal route. If external, use `href` instead. */
    to?: string;
    href?: string;
    onClick?: () => void;
  };
  secondary?: {
    label: string;
    to?: string;
    href?: string;
    onClick?: () => void;
  };
  /** Passed through so pages can adjust vertical padding. */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primary,
  secondary,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-4 px-6 py-16 text-center ${className}`}>
      <div
        aria-hidden="true"
        className="grid h-20 w-20 place-items-center rounded-full bg-farm/12 text-farm"
      >
        <Icon className="h-9 w-9" strokeWidth={1.75} />
      </div>
      <div className="max-w-sm">
        <h2 className="text-[17px] font-semibold text-ink lg:text-[19px]">{title}</h2>
        {description && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
            {description}
          </p>
        )}
      </div>
      {(primary || secondary) && (
        <div className="mt-1 flex flex-col items-center gap-2">
          {primary && <ActionButton spec={primary} variant="primary" />}
          {secondary && <ActionButton spec={secondary} variant="secondary" />}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  spec,
  variant,
}: {
  spec: NonNullable<EmptyStateProps["primary"]>;
  variant: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-background shadow-sm transition hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
      : "inline-flex items-center justify-center rounded-full border border-divider bg-surface px-5 py-2.5 text-[13px] font-semibold text-ink hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20";

  if (spec.to) {
    // TanStack Router typed Link — we treat `to` as a generic string here so
    // callers on any known route can pass their path without extra typing.
    // If the path is unknown, TS on the caller side catches it.
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={spec.to as any} className={cls}>
        {spec.label}
      </Link>
    );
  }
  if (spec.href) {
    return (
      <a href={spec.href} className={cls}>
        {spec.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={spec.onClick} className={cls}>
      {spec.label}
    </button>
  );
}
