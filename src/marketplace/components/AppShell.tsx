import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-lg pb-24">{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
