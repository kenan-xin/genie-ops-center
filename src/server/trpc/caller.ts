import "server-only";

import { createCallerFactory, createTRPCContext } from "./init";
import { appRouter } from "./router";

/**
 * Direct server-side caller for React Server Components — no HTTP hop.
 * RSCs fetch their initial data through this; interactive client code uses
 * the tanstack-query hooks instead (see src/trpc/provider.tsx).
 */
export const caller = createCallerFactory(appRouter)(createTRPCContext);
