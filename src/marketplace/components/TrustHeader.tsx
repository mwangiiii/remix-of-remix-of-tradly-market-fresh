import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function TrustHeader({
  title, back = "/", right,
}: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-trust-deep/30 bg-trust-deep px-4 py-3.5 text-trust-deep-foreground">
      <Link to={back} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h1 className="truncate text-center text-[15px] font-semibold">{title}</h1>
      <div className="min-w-9 justify-self-end">{right}</div>
    </header>
  );
}
