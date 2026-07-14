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

        const entries: { path: string; changefreq: string; priority: string }[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
        ];

        if (supabaseUrl && supabaseAnonKey) {
          try {
            const sb = createClient(supabaseUrl, supabaseAnonKey, {
              auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            });
            const [cats, prods] = await Promise.all([
              sb.from("marketplace_categories").select("slug").order("display_order"),
              sb.from("marketplace_products").select("slug").order("name"),
            ]);
            for (const c of cats.data ?? []) {
              entries.push({
                path: `/category/${(c as { slug: string }).slug}`,
                changefreq: "daily",
                priority: "0.8",
              });
            }
            for (const p of prods.data ?? []) {
              entries.push({
                path: `/product/${(p as { slug: string }).slug}`,
                changefreq: "daily",
                priority: "0.7",
              });
            }
          } catch {
            // On failure, ship at least the home entry rather than 500.
          }
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${SITE_URL}${e.path}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            `    <changefreq>${e.changefreq}</changefreq>`,
            `    <priority>${e.priority}</priority>`,
            `  </url>`,
          ].join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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
