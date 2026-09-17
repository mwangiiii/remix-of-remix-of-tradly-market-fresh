// Household address book (Household Commerce spec §16.2, plan D5).
// Individuals only — companies use branches at /admin (route unreachable
// from the company sign-in path, but we gate defensively here anyway).

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, MapPin, Plus, Star, Trash2, X, Loader2 } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useAuth } from "@/hooks/use-auth";
import {
  type AddressInput,
  deleteAddress,
  listDeliveryZones,
  listMyAddresses,
  setDefaultAddress,
  upsertAddress,
} from "../marketplace/api/delivery";
import { formatKes } from "../marketplace/lib/format";
import type { DeliveryZone, HouseholdAddress } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/account/addresses")({
  head: () => ({
    meta: [
      { title: "Delivery addresses — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AddressesPage,
});

function AddressesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing, buyer } = useAuth();

  // Bounce anonymous → /login (returns them here).
  if (!isInitializing && !isAuthenticated) {
    navigate({ to: "/login", search: { next: "/account/addresses" } });
  }

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["household-addresses"],
    queryFn: listMyAddresses,
    enabled: isAuthenticated,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: listDeliveryZones,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000, // zones change rarely
  });

  const [editing, setEditing] = useState<AddressInput | null>(null);

  if (isInitializing || !isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Addresses" back="/account" />
          <p className="py-16 text-center text-sm text-ink-muted">Checking your session…</p>
        </div>
      </AppShell>
    );
  }

  // Household commerce is scoped to individuals. Companies use branches
  // via the tenant procurement app — this page is a wrong turn for them.
  if (buyer?.businessType === "company") {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Addresses" back="/account" />
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-divider bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">
              Your workspace uses branches, not household addresses.
            </p>
            <p className="mt-2 text-[13px] text-ink-muted">
              Manage delivery locations from Settings → Branches in your admin app.
            </p>
            <Link
              to="/account"
              className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background"
            >
              Back to account
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pb-24 lg:px-8">
        <TrustHeader title="Delivery addresses" back="/account" />

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px] text-ink-muted">
            Landmarks help the rider find you faster than a pin.
          </p>
          <button
            type="button"
            onClick={() => setEditing({ area: "", isDefault: addresses.length === 0 })}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {addressesLoading && (
            <li className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
            </li>
          )}
          {!addressesLoading && addresses.length === 0 && (
            <li className="rounded-2xl border border-dashed border-divider py-10 text-center text-[13px] text-ink-muted">
              <Home className="mx-auto mb-2 h-6 w-6 opacity-60" />
              No addresses yet. Add one so the rider knows where to bring your order.
            </li>
          )}
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              zones={zones}
              onEdit={() => setEditing(fromAddress(a))}
            />
          ))}
        </ul>
      </div>

      {editing && (
        <AddressEditor
          value={editing}
          zones={zones}
          onChange={setEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </AppShell>
  );
}

function fromAddress(a: HouseholdAddress): AddressInput {
  return {
    id: a.id,
    label: a.label,
    area: a.area,
    estateOrBuilding: a.estateOrBuilding,
    houseOrDoor: a.houseOrDoor,
    landmark: a.landmark,
    zoneId: a.zoneId,
    lat: a.lat,
    lng: a.lng,
    deliveryNotes: a.deliveryNotes,
    isDefault: a.isDefault,
  };
}

function AddressCard({
  address,
  zones,
  onEdit,
}: {
  address: HouseholdAddress;
  zones: DeliveryZone[];
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const zone = zones.find((z) => z.id === address.zoneId);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["household-addresses"] });

  const del = useMutation({
    mutationFn: () => deleteAddress(address.id),
    onSuccess: () => {
      invalidate();
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Delete failed"),
  });

  const setDefault = useMutation({
    mutationFn: () => setDefaultAddress(address.id),
    onSuccess: () => {
      invalidate();
      toast.success("Default updated");
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not set default"),
  });

  return (
    <li className="rounded-2xl border border-divider bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-trust" />
            <p className="text-[14px] font-semibold text-ink">
              {address.label || address.area}
            </p>
            {address.isDefault && (
              <span className="rounded-full bg-farm/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-farm">
                Default
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {[address.houseOrDoor, address.estateOrBuilding, address.area]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {address.landmark && (
            <p className="mt-0.5 text-[12px] text-ink-muted italic">"{address.landmark}"</p>
          )}
          <p className="mt-1.5 text-[11px] font-medium text-ink-muted">
            {zone ? (
              <>
                Zone: <span className="text-ink">{zone.name}</span> · Delivery{" "}
                <span className="text-ink">{formatKes(zone.customerFeeKes)}</span> · Cutoff{" "}
                <span className="text-ink">{zone.sameDayCutoffTime.slice(0, 5)}</span>
              </>
            ) : (
              <span className="text-amber-700">
                Not in a rider zone yet — courier pickup or self-collect at checkout.
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-divider bg-background px-3 py-1 text-[11px] font-semibold text-ink hover:border-ink/40"
          >
            Edit
          </button>
          {!address.isDefault && (
            <button
              type="button"
              onClick={() => setDefault.mutate()}
              disabled={setDefault.isPending}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-divider bg-background px-3 py-1 text-[11px] font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
            >
              <Star className="h-3 w-3" /> Default
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (confirm(`Delete ${address.label || address.area}?`)) del.mutate(); }}
            disabled={del.isPending}
            className="grid h-7 w-7 place-self-end place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function AddressEditor({
  value,
  zones,
  onChange,
  onClose,
}: {
  value: AddressInput;
  zones: DeliveryZone[];
  onChange: (v: AddressInput | null) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const set = (patch: Partial<AddressInput>) => onChange({ ...value, ...patch });

  const save = useMutation({
    mutationFn: (v: AddressInput) => upsertAddress(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["household-addresses"] });
      toast.success(value.id ? "Updated" : "Address added");
      onChange(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const submit = () => {
    if (!value.area.trim()) {
      toast.error("Area is required (e.g. Kilimani)");
      return;
    }
    save.mutate(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider bg-surface px-5 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {value.id ? "Edit address" : "New address"}
            </p>
            <h2 className="text-[16px] font-semibold text-ink">
              {value.label || value.area || "Untitled"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FieldRow label="Label (optional)">
            <input
              value={value.label ?? ""}
              onChange={(e) => set({ label: e.target.value || null })}
              placeholder="Home, Mum's, Office"
              className={inputCls}
            />
          </FieldRow>

          <FieldRow label="Area">
            <input
              list="delivery-zone-areas"
              value={value.area}
              onChange={(e) => {
                // Reset the manual zone override so save resolves against
                // the new area unless the user explicitly picks below.
                set({ area: e.target.value, zoneId: null });
              }}
              placeholder="Kilimani, Karen, Ruaka…"
              className={inputCls}
              autoFocus
            />
            <datalist id="delivery-zone-areas">
              {zones.flatMap((z) => z.areas).map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </FieldRow>

          <FieldRow label="Estate / building (optional)">
            <input
              value={value.estateOrBuilding ?? ""}
              onChange={(e) => set({ estateOrBuilding: e.target.value || null })}
              placeholder="Jamhuri Estate, Riverside Court"
              className={inputCls}
            />
          </FieldRow>

          <FieldRow label="House / door number (optional)">
            <input
              value={value.houseOrDoor ?? ""}
              onChange={(e) => set({ houseOrDoor: e.target.value || null })}
              placeholder="A4, Flat 12, Door 3"
              className={inputCls}
            />
          </FieldRow>

          <FieldRow label="Landmark">
            <input
              value={value.landmark ?? ""}
              onChange={(e) => set({ landmark: e.target.value || null })}
              placeholder="Blue gate opposite the shop, past Naivas"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-ink-muted">
              Riders find you by landmark faster than by pin.
            </p>
          </FieldRow>

          <FieldRow label="Zone (optional — auto-resolved from area)">
            <select
              value={value.zoneId ?? ""}
              onChange={(e) => set({ zoneId: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Auto (from area)</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} · {formatKes(z.customerFeeKes)}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Delivery notes (optional)">
            <textarea
              value={value.deliveryNotes ?? ""}
              onChange={(e) => set({ deliveryNotes: e.target.value || null })}
              rows={2}
              placeholder="Gate code 4321, dog on premises, call on arrival"
              className={inputCls}
            />
          </FieldRow>

          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={value.isDefault ?? false}
              onChange={(e) => set({ isDefault: e.target.checked })}
            />
            Use as default at checkout
          </label>
        </div>

        <footer className="border-t border-divider bg-surface px-5 py-3">
          <button
            type="button"
            onClick={submit}
            disabled={save.isPending}
            className="w-full rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-background disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : value.id ? "Save changes" : "Add address"}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20";

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
