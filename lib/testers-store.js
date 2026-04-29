/**
 * Vercel KV-backed store for demo testers and their session runs.
 *
 * Schema:
 *   tester:<testerId>          — { id, firstName, lastName, role, firstSeenAt, lastSeenAt }
 *   tester-by-name:<key>       — testerId  (key = lowercase "first|last")
 *   testers:all                — set of testerId strings (for admin listing)
 *   tester:<testerId>:sessions — list of sessionId strings (most recent first)
 *   session:<sessionId>        — { id, testerId, scenarioId, condition, startedAt,
 *                                  completedAt?, turns?, finalOutcome? }
 *
 * Identity is by-name match (no auth). Two testers with the same first+last
 * name will be treated as the same person. This is intentional for the demo
 * scope — see the welcome flow's mode-select.
 */
import { kv } from "@vercel/kv";

function nameKey(firstName, lastName) {
  return `${(firstName || "").trim().toLowerCase()}|${(lastName || "").trim().toLowerCase()}`;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tester upsert ──────────────────────────────────────────────────────
//
// Looks up a tester by name. Creates one if missing. Always stamps
// lastSeenAt. Returns the full tester record + their completed scenario
// ids (so the frontend can hydrate the "✓ Completed" badges).
export async function upsertTester({ firstName, lastName, role }) {
  const key = nameKey(firstName, lastName);
  const lookupKey = `tester-by-name:${key}`;

  let testerId = await kv.get(lookupKey);
  let tester;

  if (testerId) {
    tester = await kv.get(`tester:${testerId}`);
    // If the lookup key exists but the record was wiped, fall through to create.
    if (!tester) testerId = null;
  }

  const now = Date.now();

  if (!testerId) {
    testerId = newId("tester");
    tester = {
      id: testerId,
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      role: role || null,
      firstSeenAt: now,
      lastSeenAt: now,
    };
    await kv.set(`tester:${testerId}`, tester);
    await kv.set(lookupKey, testerId);
    await kv.sadd("testers:all", testerId);
  } else {
    // Update lastSeenAt + role (in case they didn't pick one before)
    tester = {
      ...tester,
      lastSeenAt: now,
      role: role || tester.role || null,
    };
    await kv.set(`tester:${testerId}`, tester);
  }

  // Pull completed scenarios for badge hydration.
  const sessionIds = (await kv.lrange(`tester:${testerId}:sessions`, 0, -1)) || [];
  const completedScenarios = [];
  for (const sid of sessionIds) {
    const s = await kv.get(`session:${sid}`);
    if (s?.completedAt && s.scenarioId && !completedScenarios.includes(s.scenarioId)) {
      completedScenarios.push(s.scenarioId);
    }
  }

  return { tester, completedScenarios };
}

// ─── Session start ──────────────────────────────────────────────────────
export async function startSession({ testerId, scenarioId, condition }) {
  if (!testerId) throw new Error("startSession: testerId required");
  const tester = await kv.get(`tester:${testerId}`);
  if (!tester) throw new Error("startSession: tester not found");

  const sessionId = newId("session");
  const session = {
    id: sessionId,
    testerId,
    scenarioId: scenarioId || null,
    condition: condition || null,
    startedAt: Date.now(),
    completedAt: null,
    turns: 0,
    finalOutcome: null,
  };
  await kv.set(`session:${sessionId}`, session);
  // lpush so most recent is first when we lrange 0 N.
  await kv.lpush(`tester:${testerId}:sessions`, sessionId);
  return session;
}

// ─── Session complete ───────────────────────────────────────────────────
export async function completeSession({ sessionId, turns, finalOutcome }) {
  if (!sessionId) throw new Error("completeSession: sessionId required");
  const session = await kv.get(`session:${sessionId}`);
  if (!session) throw new Error("completeSession: session not found");
  // Idempotent — completing twice is a no-op.
  if (session.completedAt) return session;

  const updated = {
    ...session,
    completedAt: Date.now(),
    turns: typeof turns === "number" ? turns : session.turns,
    finalOutcome: finalOutcome || session.finalOutcome,
  };
  await kv.set(`session:${sessionId}`, updated);
  return updated;
}

// ─── Save transcript ────────────────────────────────────────────────────
//
// Called periodically (after each new message) so the admin view always
// shows the latest state, even if the consultation is still in progress.
// We trim each message to role + text + time — no internal flags.
export async function saveTranscript({ sessionId, messages }) {
  if (!sessionId) throw new Error("saveTranscript: sessionId required");
  if (!Array.isArray(messages)) throw new Error("saveTranscript: messages array required");
  const session = await kv.get(`session:${sessionId}`);
  if (!session) throw new Error("saveTranscript: session not found");
  const trimmed = messages.map((m) => ({
    role: m.role,
    text: m.text || "",
    time: m.time || null,
  }));
  await kv.set(`session:${sessionId}`, {
    ...session,
    transcript: trimmed,
    transcriptUpdatedAt: Date.now(),
  });
  return { ok: true, count: trimmed.length };
}

// ─── Save feedback ──────────────────────────────────────────────────────
//
// Stores the resident's post-consultation feedback alongside the session.
// Idempotent — submitting twice overwrites the prior value (testers may
// edit before closing the tab).
export async function saveFeedback({ sessionId, feedback }) {
  if (!sessionId) throw new Error("saveFeedback: sessionId required");
  if (!feedback || typeof feedback !== "object") throw new Error("saveFeedback: feedback object required");
  const session = await kv.get(`session:${sessionId}`);
  if (!session) throw new Error("saveFeedback: session not found");
  await kv.set(`session:${sessionId}`, {
    ...session,
    feedback: {
      clinicalSoundness: feedback.clinicalSoundness ?? null,
      outcomeAccuracy: feedback.outcomeAccuracy ?? null,
      uxRating: feedback.uxRating ?? null,
      whatBroke: (feedback.whatBroke || "").slice(0, 4000),
      recommend: feedback.recommend || null,
      otherNotes: (feedback.otherNotes || "").slice(0, 4000),
      submittedAt: Date.now(),
    },
  });
  return { ok: true };
}

// ─── Admin: list all testers with their session summary ─────────────────
export async function listAllTesters() {
  const ids = (await kv.smembers("testers:all")) || [];
  const out = [];
  for (const id of ids) {
    const tester = await kv.get(`tester:${id}`);
    if (!tester) continue;
    const sessionIds = (await kv.lrange(`tester:${id}:sessions`, 0, -1)) || [];
    const sessions = [];
    for (const sid of sessionIds) {
      const s = await kv.get(`session:${sid}`);
      if (s) sessions.push(s);
    }
    out.push({
      ...tester,
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s) => s.completedAt).length,
      sessions,
    });
  }
  // Most recent activity first
  out.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
  return out;
}
