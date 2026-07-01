import { QueryClient } from "@tanstack/react-query";

// Shared by the browser provider and the RSC prefetch helper so both sides
// dehydrate/hydrate against identical defaults.
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },
    },
  });
}
