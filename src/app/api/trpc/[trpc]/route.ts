import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    // Forward the request headers (carrying the session cookie) so tRPC resolves
    // the same session RSC and /api/chat do — same accessor, same enforcement.
    createContext: () => createTRPCContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
