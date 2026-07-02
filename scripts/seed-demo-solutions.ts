/**
 * Dev seed for demo solutions — gives the /s/[slug] viewer (ticket 12) live
 * targets without hand-registering them through the admin UI. Idempotent: safe
 * to re-run; it upserts by slug and re-syncs one grant + membership.
 *
 *   DATABASE_URL=... pnpm tsx scripts/seed-demo-solutions.ts
 *
 * Seeds a `ready` embedded solution whose iframe points at the public loan
 * review app, grants it to a "Demo Access" group, and makes every existing
 * admin a member of that group so the embed is immediately openable. Also seeds
 * maintenance/down/draft embedded variants to exercise status gating.
 *
 * Direct inserts (not the admin tRPC procedures) because this is a dev-only
 * bootstrap, run out-of-band against a migrated DB — but config is still routed
 * through the same zod schema the procedures validate against, and slugs through
 * the shared `slugify`, so the rows match what the UI would produce.
 */
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { group, groupMember, groupSolution, solution, user } from "@/server/db/schema";
import { embeddedConfigSchema, slugify } from "@/features/solutions/schemas/solution";

const LOAN_REVIEW_IFRAME = "https://loan-review-app.vercel.app/";

type DemoSpec = {
  name: string;
  monogram: string;
  description: string;
  status: "ready" | "maintenance" | "down" | "draft";
  iframeUrl: string;
  /** Optional accent color pair — sets the tile background + text tint. */
  accentColor?: string;
  accentColorInvert?: string;
};

const DEMOS: DemoSpec[] = [
  {
    name: "Loan Review Console",
    monogram: "LR",
    description: "Embedded Smart-API loan application review console.",
    status: "ready",
    iframeUrl: LOAN_REVIEW_IFRAME,
    accentColor: "#2360c4",
    accentColorInvert: "#ffffff",
  },
  {
    name: "Doc Summarizer",
    monogram: "DS",
    description: "Embedded clinical document summarizer (under maintenance).",
    status: "maintenance",
    iframeUrl: LOAN_REVIEW_IFRAME,
    accentColor: "#1f9a5c",
    accentColorInvert: "#ffffff",
  },
  {
    name: "Claims Triage",
    monogram: "CT",
    description: "Embedded claims triage board (down — exercises the outage notice).",
    status: "down",
    iframeUrl: LOAN_REVIEW_IFRAME,
    accentColor: "#b07d10",
    accentColorInvert: "#ffffff",
  },
  {
    name: "Policy Drafter",
    monogram: "PD",
    description: "Embedded policy drafting tool (draft — never openable, hidden from the hub).",
    status: "draft",
    iframeUrl: LOAN_REVIEW_IFRAME,
  },
];

const GROUP_NAME = "Demo Access";

async function ensureGroup() {
  const [existing] = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.name, GROUP_NAME))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(group)
    .values({ name: GROUP_NAME, description: "Auto-grants demo solutions for local dev." })
    .returning({ id: group.id });
  return created!.id;
}

async function upsertDemo(spec: DemoSpec): Promise<string> {
  // Validate config through the same schema the admin boundary uses.
  const config = embeddedConfigSchema.parse({ iframeUrl: spec.iframeUrl });
  const slug = slugify(spec.name);

  const [existing] = await db
    .select({ id: solution.id })
    .from(solution)
    .where(eq(solution.slug, slug))
    .limit(1);
  if (existing) {
    await db
      .update(solution)
      .set({
        type: "embedded",
        status: spec.status,
        monogram: spec.monogram,
        description: spec.description,
        config,
        archived: false,
        accentColor: spec.accentColor ?? null,
        accentColorInvert: spec.accentColorInvert ?? null,
        updatedAt: new Date(),
      })
      .where(eq(solution.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(solution)
    .values({
      name: spec.name,
      slug,
      type: "embedded",
      status: spec.status,
      monogram: spec.monogram,
      description: spec.description,
      config,
      accentColor: spec.accentColor ?? null,
      accentColorInvert: spec.accentColorInvert ?? null,
    })
    .returning({ id: solution.id });
  return created!.id;
}

async function grant(groupId: string, solutionId: string) {
  await db
    .insert(groupSolution)
    .values({ groupId, solutionId })
    .onConflictDoNothing({
      target: [groupSolution.groupId, groupSolution.solutionId],
    });
}

async function addAdminsToGroup(groupId: string) {
  // Every user gets membership so the demo embed is openable immediately after
  // `pnpm db:dev && pnpm tsx scripts/seed-demo-solutions.ts`.
  const admins = await db.select({ id: user.id }).from(user);
  await Promise.all(
    admins.map((a) =>
      db
        .insert(groupMember)
        .values({ groupId, userId: a.id })
        .onConflictDoNothing({ target: [groupMember.groupId, groupMember.userId] }),
    ),
  );
  return admins.length;
}

async function main() {
  const groupId = await ensureGroup();
  const memberCount = await addAdminsToGroup(groupId);

  for (const spec of DEMOS) {
    const id = await upsertDemo(spec);
    await grant(groupId, id);
    console.info(`  ✓ ${spec.name} → ${spec.status} (granted to ${GROUP_NAME})`);
  }

  // Echo the embedded solutions now on disk (grant + membership are set above).
  const onDisk = await db
    .select({ slug: solution.slug, status: solution.status })
    .from(solution)
    .where(eq(solution.type, "embedded"));
  console.info(`\nGranted to ${memberCount} user(s). Embedded solutions on disk:`);
  for (const r of onDisk) console.info(`    · /s/${r.slug} — ${r.status}`);

  console.info("\nDone. Sign in as the seeded admin and open /s/loan-review-console.");
  process.exit(0);
}

main().catch((e) => {
  console.error("seed crashed:", e);
  process.exit(1);
});
