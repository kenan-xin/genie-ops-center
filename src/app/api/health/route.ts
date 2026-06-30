import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { sql } from "drizzle-orm";

// Lightweight liveness/readiness probe (ticket 03b). Reports server-up plus a
// DB round-trip, so an orchestrator can distinguish "app alive" from "DB down".
// Unauthenticated by design; leaks no data beyond up/down + a timestamp.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: "degraded", error: err instanceof Error ? err.message : "db error" },
      { status: 503 },
    );
  }
}
