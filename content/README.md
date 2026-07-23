# /content — SEO + GEO plan (not runtime code)

Files in this folder are **planning artefacts**, not shipped assets:

- `keyword-url-map.csv` — the full 137-intent keyword universe mapped to a target URL. Read alongside your ads platform to keep ad groups and organic pages in lockstep.
- `blog-briefs.md` — writer-ready briefs for the 15 planned marketing articles (`/blog/*` routes that don't exist yet — the CSV points to them anyway so the plan is complete on paper).

## Status of the target URLs

The CSV points to 42 canonical URLs. Today the site actually serves:

- `/`, `/faq`, `/category/{slug}`, `/product/{slug}`, plus buyer-only surfaces (correctly `noindex`ed).

**Everything else in the CSV is not built yet.** Do NOT add those URLs to `sitemap.xml` before the routes ship — sending Googlebot to 404s costs crawl budget and quality signals.

## Recommended order of build-out

1. **`/about`, `/how-it-works`, `/pricing`, `/contact`, `/etims-compliance`** — real static copy is cheap to write and each one lights up an existing keyword cluster.
2. **`/for/hotels-restaurants`, `/for/hospitals`, `/for/schools`, `/for/corporates`, `/for/caterers`** — sector landing pages. Reuse a shared template + `serviceLd()` schema.
3. **`/wholesale`, `/corporate-gifting`** — commercial landing pages.
4. **`/sell`, `/suppliers/register`** — supply-side (may just link into the flow app).
5. **`/market-prices`, `/reviews`** — dynamic pages; need data sources first.
6. **`/blog` + the 15 articles** — do this LAST. Empty blog routes with placeholder copy are actively harmful (thin content). Wait until each article is written.

Each time a route ships, add its line to the dynamic sitemap route (`src/routes/sitemap[.]xml.ts`) and — if it maps to a new intent — update this folder.
