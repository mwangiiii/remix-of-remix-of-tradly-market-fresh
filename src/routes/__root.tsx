import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
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
} from "../marketplace/lib/seo";

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
        { title: SITE_NAME },
        { name: "description", content: description },
        { name: "author", content: "Tradly" },
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
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "canonical", href: SITE_URL },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      ],
      scripts: [jsonLd(organizationLd()), jsonLd(websiteLd())],
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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton={false} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
