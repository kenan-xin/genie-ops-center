/**
 * Root-cause repro for the "/" hub landing 500 (solutionsHub.list). Run against
 * a migrated + seeded dev DB:
 *   pnpm dlx tsx --conditions=react-server scripts/repro-hub-list-500.ts
 *
 * Signs in as the seeded admin (same as a real browser session), then walks
 * every layer a real "/" render touches, in isolation, so we can see exactly
 * which one throws: the bare query (queries.ts), the tRPC procedure (router.ts
 * via appRouter.createCaller), or the layout's favorites() rail fetch.
 */
import { auth } from "@/server/auth";
import { getServerAuth } from "@/server/authz";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { listFavoriteSolutions, listHubSolutions } from "@/features/solutions-hub/server/queries";

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.info(`  ✓ ${name}`, Array.isArray(result) ? `(${result.length} rows)` : "");
    return result;
  } catch (e) {
    console.error(`  ✗ ${name} THREW:`);
    console.error(e);
    process.exitCode = 1;
    return undefined;
  }
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD;
  if (!password)
    throw new Error("Set ADMIN_PASSWORD (matches the seeded admin) to run this repro.");

  console.info("[0] signing in as seeded admin");
  const res = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error(`sign-in failed: ${res.status}`);
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const headers = new Headers({ cookie: cookieHeader });

  const serverAuth = await getServerAuth(headers);
  console.info(`  session status: ${serverAuth.status}`);
  if (serverAuth.status !== "authenticated") {
    throw new Error(`expected authenticated session, got ${serverAuth.status}`);
  }
  const user = serverAuth.user;

  console.info("\n[1] bare query — queries.ts:listHubSolutions (what the page prefetches)");
  await step("listHubSolutions(user, {sort:'recent'})", () =>
    listHubSolutions(user, { sort: "recent" }),
  );

  console.info("\n[2] bare query — queries.ts:listFavoriteSolutions (layout's PINNED rail)");
  await step("listFavoriteSolutions(user)", () => listFavoriteSolutions(user));

  console.info("\n[3] tRPC procedure layer — appRouter.createCaller (router.ts wiring)");
  const ctx = await createTRPCContext({ headers });
  const trpcCaller = appRouter.createCaller(ctx);
  await step("caller.solutionsHub.list({sort:'recent'})", () =>
    trpcCaller.solutionsHub.list({ sort: "recent" }),
  );
  await step("caller.solutionsHub.favorites()", () => trpcCaller.solutionsHub.favorites());

  console.info(`\n${process.exitCode ? "FAILURE(S) ABOVE" : "ALL LAYERS OK"}`);
}

main().catch((e) => {
  console.error("repro crashed:", e);
  process.exit(2);
});
