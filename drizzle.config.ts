import { defineConfig } from "drizzle-kit";

// drizzle-kit owns the only migration history (generate → ./drizzle); the
// container entrypoint runs `drizzle migrate` (ticket 03b). Reads DATABASE_URL
// from the environment — set it (or use a .env) before running db: scripts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
