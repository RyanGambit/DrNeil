"use client";

import { useState } from "react";

const ROLE_LABELS = {
  urologist: "Urologist",
  gp: "Family physician / GP",
  resident: "Resident / fellow",
  "other-clinical": "Other clinician",
  "non-clinical": "Non-clinical reviewer",
};

const SCENARIO_LABELS = {
  "bph-1": "BPH — Outcome B (Tran)",
  "bph-2": "BPH — Elevated PSA (Chen)",
  "bph-3": "BPH — High PVR (Kowalski)",
  "ed-1": "ED — First-time (Park)",
  "ed-2": "ED — PDE5i failure (Stevens)",
  "ed-3": "ED — Nitrate (Delgado)",
  "ed-4": "ED — Young/situational (Rivera)",
  "mh-1": "MH — Apixaban (Whitfield)",
  "mh-2": "MH — Low risk (Brown)",
  "mh-3": "MH — Smoker/gross (Hayes)",
  "mh-4": "MH — Premenopausal (Okafor)",
};

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export default function AdminTesters() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [authed, setAuthed] = useState(false);
  const [testers, setTesters] = useState([]);
  const [expanded, setExpanded] = useState(null);
  // Drill into a specific session to see the transcript + feedback.
  const [openSession, setOpenSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const authHeader =
    "Basic " + (typeof window !== "undefined"
      ? btoa(`${credentials.username}:${credentials.password}`)
      : "");

  const fetchTesters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/testers", { headers: { Authorization: authHeader } });
      if (res.status === 401) {
        setAuthed(false);
        setError("Invalid credentials");
        return;
      }
      const data = await res.json();
      setTesters(Array.isArray(data) ? data : []);
      setAuthed(true);
    } catch (e) {
      setError("Failed to load testers");
    }
    setLoading(false);
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5FBF9", fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
        <form onSubmit={(e) => { e.preventDefault(); fetchTesters(); }} style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #D8F0EA", boxShadow: "0 2px 16px rgba(26,107,91,0.06)", width: 360 }}>
          <h1 style={{ fontSize: 22, color: "#1F2937", margin: "0 0 6px", fontFamily: "'Georgia', serif" }}>Tester admin</h1>
          <p style={{ fontSize: 13, color: "#506D65", margin: "0 0 20px" }}>Demo testers and their session activity.</p>
          <input
            type="text" placeholder="Username" autoComplete="username"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #D8F0EA", marginBottom: 10, fontSize: 14 }}
          />
          <input
            type="password" placeholder="Password" autoComplete="current-password"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #D8F0EA", marginBottom: 16, fontSize: 14 }}
          />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 12, background: "#1A6B5B", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>
            {loading ? "…" : "Sign in"}
          </button>
          {error && <p style={{ color: "#c73a3a", fontSize: 13, marginTop: 12 }}>{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5FBF9", fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #D8F0EA", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 20, color: "#1F2937", margin: 0, fontFamily: "'Georgia', serif" }}>Tester admin</h1>
        <button type="button" onClick={fetchTesters} disabled={loading} style={{ padding: "8px 14px", border: "1.5px solid #1A6B5B", background: "#fff", color: "#1A6B5B", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 80px" }}>
        {!testers.length && <p style={{ color: "#506D65" }}>No testers yet. Once someone runs through the tester flow, they'll show up here.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          <Stat label="Total testers" value={testers.length} />
          <Stat label="Total sessions" value={testers.reduce((a, t) => a + t.totalSessions, 0)} />
          <Stat label="Completed sessions" value={testers.reduce((a, t) => a + t.completedSessions, 0)} />
        </div>

        <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#E8F3EF", padding: "10px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1A6B5B", letterSpacing: 0.5, display: "grid", gridTemplateColumns: "1.6fr 1.2fr 80px 80px 1fr 32px", gap: 12 }}>
            <span>Tester</span>
            <span>Role</span>
            <span style={{ textAlign: "right" }}>Started</span>
            <span style={{ textAlign: "right" }}>Done</span>
            <span>Last seen</span>
            <span></span>
          </div>
          {testers.map((t) => (
            <div key={t.id} style={{ borderTop: "1px solid #F0F4F2" }}>
              <div
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1.6fr 1.2fr 80px 80px 1fr 32px", gap: 12, alignItems: "center", cursor: "pointer", fontSize: 14, color: "#1F2937" }}
              >
                <span style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</span>
                <span style={{ color: "#506D65" }}>{ROLE_LABELS[t.role] || (t.role ? t.role : "—")}</span>
                <span style={{ textAlign: "right" }}>{t.totalSessions}</span>
                <span style={{ textAlign: "right", color: t.completedSessions > 0 ? "#1A6B5B" : "#506D65", fontWeight: t.completedSessions > 0 ? 600 : 400 }}>{t.completedSessions}</span>
                <span style={{ color: "#506D65", fontSize: 13 }}>{fmtDate(t.lastSeenAt)}</span>
                <span style={{ color: "#506D65", textAlign: "center", transform: expanded === t.id ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>›</span>
              </div>
              {expanded === t.id && (
                <div style={{ background: "#FAFCFB", borderTop: "1px solid #F0F4F2", padding: "12px 16px 16px" }}>
                  {!t.sessions.length && <p style={{ fontSize: 13, color: "#506D65", margin: 0 }}>No sessions started yet.</p>}
                  {t.sessions.map((s) => {
                    const dur = s.completedAt ? s.completedAt - s.startedAt : null;
                    const isOpen = openSession === s.id;
                    return (
                      <div key={s.id} style={{ borderBottom: "1px solid #F0F4F2" }}>
                        <div
                          onClick={() => setOpenSession(isOpen ? null : s.id)}
                          style={{
                            padding: "10px 0", display: "grid",
                            gridTemplateColumns: "1.4fr 1fr 1fr 80px 1fr 24px",
                            gap: 12, fontSize: 13, cursor: "pointer", alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#1F2937", fontWeight: 500 }}>{SCENARIO_LABELS[s.scenarioId] || s.scenarioId || "—"}</span>
                          <span style={{ color: "#506D65" }}>{s.condition ? s.condition.toUpperCase() : "—"}</span>
                          <span style={{ color: "#506D65" }}>{fmtDate(s.startedAt)}</span>
                          <span style={{ color: s.completedAt ? "#1A6B5B" : "#b87600", fontWeight: 600 }}>
                            {s.completedAt ? "✓ done" : "in progress"}
                          </span>
                          <span style={{ color: "#506D65" }}>{dur != null ? `${fmtDuration(dur)} · ${s.turns || 0} turns` : "—"}</span>
                          <span style={{ color: "#506D65", textAlign: "center", transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>›</span>
                        </div>
                        {isOpen && (
                          <SessionDetail session={s} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function SessionDetail({ session }) {
  const fb = session.feedback;
  const transcript = Array.isArray(session.transcript) ? session.transcript : [];
  return (
    <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 8, padding: "12px 14px", margin: "0 0 12px" }}>
      {/* Feedback summary */}
      {fb ? (
        <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F0F4F2" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1A6B5B", letterSpacing: 0.5, marginBottom: 8 }}>
            Feedback &middot; {new Date(fb.submittedAt).toLocaleString("en-CA")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
            <RatingBox label="Clinical soundness" value={fb.clinicalSoundness} />
            <RatingBox label="Outcome accuracy" value={fb.outcomeAccuracy} />
            <RatingBox label="UX" value={fb.uxRating} />
          </div>
          <div style={{ fontSize: 13, color: "#1F2937", marginBottom: 6 }}>
            <strong>Recommend:</strong>{" "}
            <span style={{ color: fb.recommend === "yes" ? "#1A6B5B" : fb.recommend === "no" ? "#c73a3a" : "#b87600", fontWeight: 600 }}>
              {fb.recommend ? fb.recommend.toUpperCase() : "—"}
            </span>
          </div>
          {fb.whatBroke && (
            <div style={{ fontSize: 13, color: "#1F2937", marginBottom: 6, background: "#FAFCFB", border: "1px solid #F0F4F2", padding: "8px 10px", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#506D65", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>What broke / wrong</div>
              {fb.whatBroke}
            </div>
          )}
          {fb.otherNotes && (
            <div style={{ fontSize: 13, color: "#1F2937", background: "#FAFCFB", border: "1px solid #F0F4F2", padding: "8px 10px", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#506D65", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Other notes</div>
              {fb.otherNotes}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#506D65", marginBottom: 10, fontStyle: "italic" }}>
          {session.completedAt ? "Tester didn't submit feedback." : "Session in progress — feedback not yet captured."}
        </div>
      )}

      {/* Transcript */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1A6B5B", letterSpacing: 0.5, marginBottom: 6 }}>
        Transcript {transcript.length ? `(${transcript.length} messages)` : ""}
      </div>
      {transcript.length === 0 ? (
        <div style={{ fontSize: 13, color: "#506D65", fontStyle: "italic" }}>
          No transcript captured yet.
        </div>
      ) : (
        <div style={{ maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "4px 2px" }}>
          {transcript.map((m, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column",
              alignItems: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                color: m.role === "user" ? "#3D5D80" : "#1A6B5B",
                marginBottom: 2,
              }}>
                {m.role === "user" ? "Patient" : "Dr. Neil"}
              </div>
              <div style={{
                maxWidth: "78%", padding: "8px 12px", borderRadius: 10,
                background: m.role === "user" ? "#EEF3F8" : "#F5FBF9",
                border: "1px solid #E8F3EF",
                fontSize: 13, color: "#1F2937", lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
                {m.text || ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingBox({ label, value }) {
  return (
    <div style={{ background: "#FAFCFB", border: "1px solid #F0F4F2", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#506D65", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1A6B5B", lineHeight: 1.2, marginTop: 2 }}>
        {value ? `${value}/5` : "—"}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#506D65", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#1A6B5B", lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    </div>
  );
}
