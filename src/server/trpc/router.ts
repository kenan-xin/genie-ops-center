import { z } from "zod";

import { baseProcedure, createTRPCRouter } from "./init";

/**
 * Root app router. Feature routers merge in here as later tickets land
 * (auth, solutions, admin). `hello` is a scaffolding smoke-test procedure
 * proving the roundtrip from both the RSC caller and the client hook.
 */
export const appRouter = createTRPCRouter({
  hello: baseProcedure.input(z.object({ name: z.string() }).optional()).query(({ input }) => ({
    greeting: `Hello, ${input?.name ?? "operator"}.`,
  })),
});

export type AppRouter = typeof appRouter;
