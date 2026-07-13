import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingCart, ListChecks, Package, User } from "lucide-react";
import { useCartStore, cartCount } from "../store/cartStore";

const tabs = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/lists", label: "Lists", icon: ListChecks },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/account", label: "Account", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lines = useCartStore((s) => s.lines);
  const count = cartCount(lines);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
          const Icon = t.icon;
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-trust" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{t.label}</span>
                {t.to === "/cart" && count > 0 && (
                  <span className="absolute right-[calc(50%-22px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-farm px-1 text-[10px] font-bold text-farm-foreground">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
