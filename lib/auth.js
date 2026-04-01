// ═══════════════════════════════════════════════════════════════════════
// ADMIN AUTH — Simple username/password from env vars
// For production: replace with NextAuth, Clerk, or OAuth
// ═══════════════════════════════════════════════════════════════════════

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
  const [username, password] = decoded.split(":");

  // Require env vars — no hardcoded fallbacks
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return false;
  }

  return (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  );
}

export function unauthorizedResponse() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AskDrFleshner Admin"',
    },
  });
}
