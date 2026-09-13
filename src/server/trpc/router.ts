import { z } from "zod";

import { categoriesRouter } from "@/features/categories/server/router";
import { chatRouter } from "@/features/chat/server/router";
import { groupsRouter } from "@/features/groups/server/router";
import { solutionsRouter } from "@/features/solutions/server/router";
import { solutionsHubRouter } from "@/features/solutions-hub/server/router";
import { themesRouter } from "@/features/themes/server/router";
import { usersRouter } from "@/features/users/server/router";

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
  chat: chatRouter,
  categories: categoriesRouter,
  groups: groupsRouter,
  themes: themesRouter,
  solutions: solutionsRouter,
  solutionsHub: solutionsHubRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
