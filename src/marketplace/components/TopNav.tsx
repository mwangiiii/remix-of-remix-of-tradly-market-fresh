import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingCart, Bell, User } from "lucide-react";
import { useCartStore, cartCount } from "../store/cartStore";
import { Wordmark } from "./BrowseHeader";

const links: { to: string; label: string }[] = [
  { to: "/", label: "Shop" },
  { to: "/orders", label: "Orders" },
  { to: "/lists", label: "Lists" },
];

/**
 * Desktop-only top nav. Hidden on mobile — the BottomNav takes over below `lg`.
 */
export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lines = useCartStore((s) => s.lines);
  const count = cartCount(lines);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-divider bg-background/85 backdrop-blur-xl lg:block">
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-8 py-4">
        <Link to="/" className="shrink-0">
          <Wordmark className="text-[17px]" />
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors ${
                  active ? "bg-ink text-background" : "text-ink-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/notifications"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
          </Link>
          <Link
            to="/cart"
            className="relative grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
            aria-label="Cart"
          >
            <ShoppingCart className="h-4.5 w-4.5" strokeWidth={1.75} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-farm px-1 text-[10px] font-bold text-farm-foreground">
                {count}
              </span>
            )}
          </Link>
          <Link
            to="/account"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
            aria-label="Account"
          >
            <User className="h-4.5 w-4.5" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </header>
  );
}
