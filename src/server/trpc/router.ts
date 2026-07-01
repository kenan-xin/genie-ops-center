import { z } from "zod";

import { themesRouter } from "@/features/themes/server/router";

import { createTRPCRouter, publicProcedure } from "./init";

/**
 * Root app router. Feature routers merge in here as later tickets land
 * (auth, solutions, admin). `hello` is a scaffolding smoke-test procedure
 * proving the roundtrip from both the RSC caller and the client hook.
 */
export const appRouter = createTRPCRouter({
  hello: publicProcedure.input(z.object({ name: z.string() }).optional()).query(({ input }) => ({
    greeting: `Hello, ${input?.name ?? "operator"}.`,
  })),
  themes: themesRouter,
});

export type AppRouter = typeof appRouter;
