const windows = new Map();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 30; // per IP per minute

export function checkRateLimit(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const now = Date.now();
  const key = ip;

  let record = windows.get(key);
  if (!record || now - record.start > WINDOW_MS) {
    record = { start: now, count: 0 };
    windows.set(key, record);
  }

  record.count++;

  // Periodic cleanup of stale entries
  if (windows.size > 1000) {
    for (const [k, v] of windows) {
      if (now - v.start > WINDOW_MS) windows.delete(k);
    }
  }

  if (record.count > MAX_REQUESTS) {
    return { limited: true, remaining: 0 };
  }
  return { limited: false, remaining: MAX_REQUESTS - record.count };
}
