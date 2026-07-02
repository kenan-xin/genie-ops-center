import "server-only";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { allowedIframeOrigins } from "@/server/config";
import { db } from "@/server/db";
import { solution } from "@/server/db/schema";
import type { AuthUser } from "@/server/authz";
import {
  configByTypeSchema,
  type ChatConfig,
  type EmbeddedConfig,
} from "@/features/solutions/schemas/solution";
import { assertCanRun, assertCanSee } from "@/server/features/solution-access";
import { isAllowedEndpoint } from "@/lib/url-guard";

/**
 * The `/s/[slug]` viewer resolver (FR-VIEW). Server-side resolution applies the
 * two distinct guards (tech-plan → see/run):
 *
 *  - `assertCanSee` (granted + not archived + not draft) — gates whether the
 *    shell + a status notice may render at all. A miss is 404 (archived/draft/
 *    missing hide existence) or 403 (no grant).
 *  - `assertCanRun` (see AND status = ready) — gates the LIVE experience. Only
 *    a runnable solution exposes its runtime config to the client: the embed
 *    `iframeUrl` (a customer-facing URL, not a secret) and the chat
 *    `welcomeMessage`/`starterPrompts`. The chat `apiEndpoint`/`botUuid` never
 *    leave the server (they're handled by `/api/chat`, ticket 13/14).
 *
 * The payload is a discriminated union over status/type so the page renders one
 * surface per branch with no client-side access reasoning.
 */

export type ViewerSurface =
  | { kind: "status-notice"; status: "maintenance" | "down"; solution: ViewerSolutionMeta }
  | { kind: "embedded"; solution: ViewerSolutionMeta; iframeUrl: string }
  | {
      kind: "chat-slot";
      solution: ViewerSolutionMeta;
      welcomeMessage?: string;
      starterPrompts?: string[];
      feedbackEnabled: boolean;
    }
  | { kind: "not-openable"; solution: ViewerSolutionMeta };

export type ViewerSolutionMeta = {
  id: string;
  name: string;
  slug: string;
  type: "chat" | "native" | "embedded";
  monogram: string | null;
  accentColor: string | null;
  accentColorInvert: string | null;
  description: string | null;
};

/**
 * Resolve the viewer surface for `(user, slug)`. Throws TRPCError on any access
 * failure (the page maps it to a notFound / forbidden render). `recordRecent`
 * is the caller's responsibility (called once on a successful see).
 */
export async function resolveViewerSurface(user: AuthUser, slug: string): Promise<ViewerSurface> {
  const [row] = await db
    .select({
      id: solution.id,
      name: solution.name,
      slug: solution.slug,
      type: solution.type,
      status: solution.status,
      description: solution.description,
      monogram: solution.monogram,
      accentColor: solution.accentColor,
      accentColorInvert: solution.accentColorInvert,
      archived: solution.archived,
      config: solution.config,
    })
    .from(solution)
    .where(eq(solution.slug, slug))
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Solution not available" });
  }

  // see guard — gates the shell + status notice. Draft/archived/missing all
  // collapse to 404 so existence never leaks; no-grant is 403.
  await assertCanSee(user, row);

  const meta: ViewerSolutionMeta = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type as ViewerSolutionMeta["type"],
    monogram: row.monogram,
    accentColor: row.accentColor,
    accentColorInvert: row.accentColorInvert,
    description: row.description,
  };

  // Maintenance/Down render a non-interactive status notice (FR-VIEW-05). The
  // see guard already passed, so the user may view the notice — just not run.
  if (row.status === "maintenance" || row.status === "down") {
    return { kind: "status-notice", status: row.status, solution: meta };
  }

  // Native has no runtime in foundation (enum-only) — never openable, even when
  // status would otherwise be ready. Reached only via a direct /s/[slug] visit
  // (the hub hides native from the catalogue).
  if (row.type === "native") {
    return { kind: "not-openable", solution: meta };
  }

  // Live experience gate: status must be ready (assertCanRun re-runs see too).
  await assertCanRun(user, row);

  const parsed = configByTypeSchema.parse({ type: row.type, config: row.config });

  if (parsed.type === "embedded") {
    const cfg = parsed.config as EmbeddedConfig;
    // Defense-in-depth: re-check the origin against ALLOWED_IFRAME_ORIGINS before
    // handing the URL to the client (the write-gate already enforces this, but a
    // legacy row or an out-of-band edit must not reach the iframe/"open in new
    // tab"). A rejected URL collapses to the not-openable notice.
    if (!isAllowedEndpoint(cfg.iframeUrl, allowedIframeOrigins())) {
      return { kind: "not-openable", solution: meta };
    }
    return { kind: "embedded", solution: meta, iframeUrl: cfg.iframeUrl };
  }

  // chat — only the client-safe display fields ride along; apiEndpoint/botUuid
  // stay server-side (the /api/chat handler owns them in tickets 13/14).
  const cfg = parsed.config as ChatConfig;
  return {
    kind: "chat-slot",
    solution: meta,
    welcomeMessage: cfg.welcomeMessage,
    starterPrompts: cfg.starterPrompts,
    // Registration defaults this true (register-solution-dialog.tsx); only an
    // explicit admin opt-out should hide feedback, so undefined -> on.
    feedbackEnabled: cfg.feedbackEnabled ?? true,
  };
}
