import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "../marketplace/lib/seo";

// Sitemap is generated server-side per request. Read the catalog directly
// from Supabase (anon-key readable rows only — RLS: only published products
// and active categories) so what ships in the sitemap always matches the
// storefront. No mock data.
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const lastmod = new Date().toISOString().slice(0, 10);

        type Entry = {
          path: string;
          changefreq: string;
          priority: string;
          // Optional per-URL image list — emitted using the sitemap-image
          // extension so Google can index product photos for Google Images.
          images?: Array<{ loc: string; title?: string }>;
        };
        const entries: Entry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          // /faq answers rarely change — weekly is honest.
          { path: "/faq", changefreq: "weekly", priority: "0.5" },
        ];

        if (supabaseUrl && supabaseAnonKey) {
          try {
            const sb = createClient(supabaseUrl, supabaseAnonKey, {
              auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            });
            const [cats, prods] = await Promise.all([
              sb.from("marketplace_categories").select("slug").order("display_order"),
              sb
                .from("marketplace_products")
                .select("slug, name, thumbnail_url")
                .order("name"),
            ]);
            for (const c of cats.data ?? []) {
              entries.push({
                path: `/category/${(c as { slug: string }).slug}`,
                changefreq: "daily",
                priority: "0.8",
              });
            }
            for (const p of prods.data ?? []) {
              const row = p as { slug: string; name: string | null; thumbnail_url: string | null };
              entries.push({
                path: `/product/${row.slug}`,
                changefreq: "daily",
                priority: "0.7",
                images: row.thumbnail_url
                  ? [{ loc: row.thumbnail_url, title: row.name ?? undefined }]
                  : undefined,
              });
            }
          } catch {
            // On failure, ship at least the home entry rather than 500.
          }
        }

        // Escape the five XML entities that would otherwise poison the doc
        // if a product title or URL contained &, <, >, ', or ".
        const esc = (s: string): string =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");

        const urls = entries.map((e) => {
          const lines = [
            `  <url>`,
            `    <loc>${esc(`${SITE_URL}${e.path}`)}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            `    <changefreq>${e.changefreq}</changefreq>`,
            `    <priority>${e.priority}</priority>`,
          ];
          for (const img of e.images ?? []) {
            lines.push(`    <image:image>`);
            lines.push(`      <image:loc>${esc(img.loc)}</image:loc>`);
            if (img.title) lines.push(`      <image:title>${esc(img.title)}</image:title>`);
            lines.push(`    </image:image>`);
          }
          lines.push(`  </url>`);
          return lines.join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
