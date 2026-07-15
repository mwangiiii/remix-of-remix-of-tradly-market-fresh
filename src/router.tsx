import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays "fresh" for 30s — during this window a component that
        // remounts (e.g. React StrictMode double-invocation or a quick
        // back-and-forth navigation) hits the cache instead of the network.
        staleTime: 30_000,
        // Keep queries in memory for 5 minutes after last use so returning
        // to a page shows the last-good data instantly while a background
        // refetch happens.
        gcTime: 5 * 60_000,
        // Refetch on window focus so a buyer coming back from another tab
        // sees fresh prices without a manual reload — this pairs with the
        // realtime subscription in AppShell to catch admin edits.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // One retry on failure — flakiness heals silently; hard errors
        // still surface within a second instead of hanging on 3 retries.
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Warm the loader for a route as soon as its Link enters the viewport
    // OR the user hovers/focuses it — snappier navigation across the app.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
