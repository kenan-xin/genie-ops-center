import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { sql } from "drizzle-orm";

// Lightweight liveness/readiness probe (ticket 03b). Reports server-up plus a
// DB round-trip, so an orchestrator can distinguish "app alive" from "DB down".
// Unauthenticated by design — returns ONLY up/down, never the underlying error
// (raw pg errors can leak hostnames/users/topology). Detail goes to server logs.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[health] DB check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
