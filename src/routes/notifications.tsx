import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { getNotifications } from "../marketplace/api/marketplaceApi";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Notifications,
});

function Notifications() {
  const { data = [] } = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });

  return (
    <AppShell>
      <div className="px-4">
        <TrustHeader title="Notifications" back="/" />

        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">Nothing new.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-2xl border border-divider bg-surface p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-trust/10 text-trust">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{n.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-muted">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                  </p>
                </div>
                {n.requestNumber && (
                  <Link to="/orders" className="text-[12px] font-semibold text-trust">View</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
