import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Transport only successful public catalogue queries; never serialize mutations,
    // sessions or administrative snapshots into page HTML.
    dehydrate: () => ({
      queryClientState: JSON.stringify(
        dehydrate(queryClient, {
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: (q) =>
            q.state.status === "success" &&
            ["store", "products", "categories"].includes(String(q.queryKey[0])),
        }),
      ),
    }),
    hydrate: (state) => {
      hydrate(queryClient, JSON.parse(state.queryClientState));
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
