import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../contexts/AuthProvider";
import {
  SITE_URL,
  SITE_NAME,
  SITE_LOCALE,
  DEFAULT_OG_IMAGE,
  jsonLd,
  organizationLd,
  websiteLd,
  localBusinessLd,
} from "../marketplace/lib/seo";

// Every catalog image is served from the Supabase Storage origin, so warm
// the TCP+TLS handshake in the initial HTML rather than waiting until the
// first <img> triggers it.
const SUPABASE_ORIGIN = ((): string | undefined => {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
})();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-farm">404</h1>
        <h2 className="mt-4 text-lg font-semibold text-ink">Page not found</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Let's get you back to fresh produce.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-farm px-5 py-2.5 text-sm font-semibold text-farm-foreground"
          >
            Browse marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-muted">Refresh or head home to try again.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-full bg-trust px-5 py-2.5 text-sm font-semibold text-trust-foreground"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold text-ink">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const description =
      "Order fresh vegetables, fruits, rice, dairy and cooking essentials from Tradly. Same-day dispatch, one supplier, one invoice.";
    const ogTitle = "Tradly Market — Fresh produce for Kenyan kitchens";
    const ogDescription =
      "Order fresh produce and food-service essentials. Sourced from Tradly — Kenya's single-source supply chain.";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: "Tradly Market — Fresh produce for Kenyan kitchens" },
        { name: "description", content: description },
        { name: "author", content: "Tradly" },
        // TODO(dennis): paste the content= value from Search Console's
        // "HTML tag" verification method, then this line goes live.
        // tradly.co.ke is already verified (see the marketing-suite repo).
        { name: "google-site-verification", content: "PASTE_TOKEN_HERE" },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: SITE_LOCALE },
        { property: "og:type", content: "website" },
        { property: "og:url", content: SITE_URL },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: ogDescription },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { property: "og:image:alt", content: "Tradly Market — fresh produce for Kenyan kitchens" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@Tradly" },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: ogDescription },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
        { name: "theme-color", content: "#FAFAF8" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // Icon set generated by scripts/build-brand-assets.mjs. Vector-first
        // (favicon.svg) with PNG fallbacks for engines that can't render SVG
        // favicons yet (older Safari, some IoT crawlers).
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { rel: "alternate icon", href: "/favicon.ico", type: "image/x-icon" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
        // PWA manifest — enables Add-to-Home-Screen + Google's PWA signals.
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "canonical", href: SITE_URL },
        ...(SUPABASE_ORIGIN
          ? [
              { rel: "preconnect", href: SUPABASE_ORIGIN, crossOrigin: "anonymous" as const },
              { rel: "dns-prefetch", href: SUPABASE_ORIGIN },
            ]
          : []),
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        // display=optional: browsers skip the font swap if Inter isn't cached
        // on first paint (system fallback stays) and use Inter on repeat
        // visits when it's in the disk cache. Eliminates the font-swap CLS
        // that was pushing 0.9+ on this page.
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=optional" },
      ],
      scripts: [
        jsonLd(organizationLd(), "ld-org"),
        jsonLd(websiteLd(), "ld-website"),
        jsonLd(localBusinessLd(), "ld-localbiz"),
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Client-only: analytics must not run during SSR, and this must stay in an
  // effect so it fires once per page load, not per render.
  useEffect(() => { initAnalytics(); }, []);

  // gtag("config") already reported the landing path, so skip the first one
  // here or it is counted twice.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFirstPath = useRef(true);
  useEffect(() => {
    if (isFirstPath.current) { isFirstPath.current = false; return; }
    trackPageView(pathname);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton={false} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
