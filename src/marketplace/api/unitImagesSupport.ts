// Feature detection for marketplace_product_units.image_urls.
//
// The column is added by supabase/migrations/20260925120000_marketplace_unit_images.sql.
// Until that migration runs, selecting the column makes PostgREST reject the
// whole query, which would blank the storefront. Queries go through
// withUnitImagesFallback: they try with the column, and on an
// "unknown column" error remember that it's missing and retry without it.

let supported = true;

/** False once a query has proven the image_urls column doesn't exist yet. */
export function unitImagesSupported(): boolean {
  return supported;
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42703 = Postgres undefined_column; PGRST204/PGRST200 = PostgREST schema-cache misses.
  const codeMatch = error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST200";
  return codeMatch && (error.message ?? "").includes("image_urls");
}

export async function withUnitImagesFallback<T extends { error: { code?: string; message?: string } | null }>(
  run: (withImages: boolean) => PromiseLike<T>,
): Promise<T> {
  if (!supported) return run(false);
  const res = await run(true);
  if (isMissingColumnError(res.error)) {
    supported = false;
    return run(false);
  }
  return res;
}
