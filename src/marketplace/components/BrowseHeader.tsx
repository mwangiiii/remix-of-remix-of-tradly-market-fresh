import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function BrowseHeader({
  title, back, right,
}: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-divider bg-background/95 px-4 py-3 backdrop-blur">
      {back ? (
        <Link to={back} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span className="h-9 w-9" />
      )}
      <h1 className="truncate text-center text-[15px] font-semibold text-ink">{title}</h1>
      <div className="min-w-9 justify-self-end">{right}</div>
    </header>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="text-farm">Tradly</span>
      <span className="text-ink-muted"> · Market</span>
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="max-w-xs text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
