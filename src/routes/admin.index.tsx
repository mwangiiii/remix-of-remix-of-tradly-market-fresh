import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Boxes, LayoutGrid, PackageCheck, Tags } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Tradly" }, { name: "robots", content: "noindex" }] }),
  component: AdminHome,
});

const tiles = [
  { to: "/admin/catalog", title: "Catalog", desc: "Products, images, effective-dated pricing", Icon: LayoutGrid },
  { to: "/admin/categories", title: "Categories", desc: "Organise the storefront taxonomy", Icon: Tags },
  { to: "/admin/inventory", title: "Inventory", desc: "On-hand, reserved, remaining, status", Icon: Boxes },
  { to: "/admin/orders", title: "Orders", desc: "Approve, post GRN, cancel — with live reservation resolution", Icon: PackageCheck },
];

function AdminHome() {
  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background text-ink">
        <header className="border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
            <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
              <h1 className="text-[17px] font-semibold">Catalog & Operations</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-20 pt-10">
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Manage everything customers see at market.tradly.co.ke — from the product catalog
            and category taxonomy to live stock and order fulfilment.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {tiles.map(({ to, title, desc, Icon }) => (
              <Link key={to} to={to} className="group rounded-3xl border border-divider bg-surface p-6 transition hover:border-ink/40">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-trust/10 text-trust">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[17px] font-semibold text-ink">{title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{desc}</p>
                <p className="mt-4 text-[12.5px] font-semibold text-ink underline decoration-divider underline-offset-4 group-hover:decoration-ink">
                  Open →
                </p>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </RequireAdmin>
  );
}
