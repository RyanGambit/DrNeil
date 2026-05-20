// ═══════════════════════════════════════════════════════════════════════
// ADMIN AUTH — Simple username/password from env vars
// For production: replace with NextAuth, Clerk, or OAuth
// ═══════════════════════════════════════════════════════════════════════

import { timingSafeEqual } from "crypto";

export function verifyAdmin(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64 = authHeader.split(" ")[1];
  if (!base64) return false;

  let decoded;
  try {
    decoded = atob(base64);
  } catch {
    return false;
  }
  if (!decoded.includes(":")) return false;
  const colonIdx = decoded.indexOf(":");
  const username = decoded.slice(0, colonIdx);
  const password = decoded.slice(colonIdx + 1);

  // Require env vars — no hardcoded fallbacks
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return false;
  }

  const usernameMatch = username.length === process.env.ADMIN_USERNAME.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(process.env.ADMIN_USERNAME));
  const passwordMatch = password.length === process.env.ADMIN_PASSWORD.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(process.env.ADMIN_PASSWORD));
  return usernameMatch && passwordMatch;
}

export function unauthorizedResponse() {
  // No WWW-Authenticate header — the admin page handles 401 in JS and
  // showing the browser's native Basic Auth dialog double-prompts users.
  return new Response("Unauthorized", { status: 401 });
}
