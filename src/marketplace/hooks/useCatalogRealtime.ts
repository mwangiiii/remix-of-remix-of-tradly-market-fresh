import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";

/**
 * Subscribe to Supabase Realtime for catalog + inventory changes so
 * price bumps, new products, and stock adjustments from super-admin show
 * up on the storefront without a manual refresh.
 *
 * Wire once at the app root; every consumer's `useQuery(["products"])`
 * (or category / product / inventory keys) automatically refetches when
 * its underlying row changes.
 *
 * Realtime channels are cheap on the client but not free on the server —
 * we scope narrowly to the tables the storefront reads.
 */
export function useCatalogRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const sb = getSupabase();
    const channel = sb
      .channel("marketplace-catalog-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_products" },
        () => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["category"] });
          qc.invalidateQueries({ queryKey: ["product"] });
          qc.invalidateQueries({ queryKey: ["search"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_product_units" },
        () => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["product"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_scheduled_prices" },
        () => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["product"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_categories" },
        () => {
          qc.invalidateQueries({ queryKey: ["categories"] });
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [qc]);
}
