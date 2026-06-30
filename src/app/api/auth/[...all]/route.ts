import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth";

// better-auth owns identity, sessions, and password reset at /api/auth/*.
// tRPC owns CRUD; the chat Route Handler owns streaming — all three read the
// same better-auth session cookie. See tech-plan → "Three API surfaces".
const handler = toNextJsHandler(auth);

export const { GET, POST, PUT, DELETE } = handler;
