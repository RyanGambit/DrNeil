"use client";

import { useMemo, useState } from "react";

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

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "urologist", label: "Urologist" },
  { value: "gp", label: "Family physician / GP" },
  { value: "resident", label: "Resident / fellow" },
  { value: "other-clinical", label: "Other clinician" },
  { value: "non-clinical", label: "Non-clinical reviewer" },
  { value: "__none__", label: "(no role)" },
];

const MODE_FILTER_OPTIONS = [
  { value: "", label: "All modes" },
  { value: "tester", label: "Tester (clinician)" },
  { value: "patient", label: "Patient" },
];

const CONDITION_FILTER_OPTIONS = [
  { value: "", label: "All conditions" },
  { value: "bph", label: "BPH" },
  { value: "ed", label: "ED" },
  { value: "mh", label: "MH" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All sessions" },
  { value: "completed", label: "Completed only" },
  { value: "in-progress", label: "In progress only" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range…" },
];

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

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminTesters() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [authHeader, setAuthHeader] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [testers, setTesters] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [openSession, setOpenSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // View toggle: "testers" (grouped) | "sessions" (flat).
  const [view, setView] = useState("testers");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // btoa() throws on code points > 0xFF, so encode UTF-8 bytes first.
  const buildAuthHeader = (username, password) => {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return "Basic " + btoa(binary);
  };

  const fetchTesters = async (header = authHeader) => {
    if (!header) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/testers", { headers: { Authorization: header } });
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

  const handleLogin = (e) => {
    e.preventDefault();
    try {
      const header = buildAuthHeader(credentials.username, credentials.password);
      setAuthHeader(header);
      fetchTesters(header);
    } catch {
      setError("Username or password contains an invalid character");
    }
  };

  // Date-range bounds derived from the picker. Sessions and testers are
  // matched by their startedAt / lastSeenAt timestamp falling inside this
  // range. "all" disables the filter.
  const dateBounds = useMemo(() => {
    const now = Date.now();
    if (dateRange === "7d") return { from: now - 7 * 24 * 60 * 60 * 1000, to: now };
    if (dateRange === "30d") return { from: now - 30 * 24 * 60 * 60 * 1000, to: now };
    if (dateRange === "custom") {
      const from = customFrom ? new Date(customFrom).getTime() : null;
      const to = customTo ? new Date(customTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
      return { from, to };
    }
    return { from: null, to: null };
  }, [dateRange, customFrom, customTo]);

  // Per-session filter — used both directly in the sessions view and to
  // recompute aggregated counts in the testers view.
  const sessionMatches = (s, tester) => {
    if (modeFilter && (tester?.mode || "tester") !== modeFilter) return false;
    if (roleFilter) {
      if (roleFilter === "__none__") {
        if (tester?.role) return false;
      } else if (tester?.role !== roleFilter) return false;
    }
    if (conditionFilter && (s.condition || "").toLowerCase() !== conditionFilter) return false;
    if (statusFilter === "completed" && !s.completedAt) return false;
    if (statusFilter === "in-progress" && s.completedAt) return false;
    if (dateBounds.from != null && s.startedAt < dateBounds.from) return false;
    if (dateBounds.to != null && s.startedAt > dateBounds.to) return false;
    return true;
  };

  // Filtered tester list. A tester is included if their name matches the
  // search box AND at least one of their sessions matches the per-session
  // filters (or if they have no sessions and no session-level filter is
  // active, so empty-shell testers still appear).
  const filteredTesters = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sessionFilterActive =
      !!conditionFilter || !!statusFilter || dateRange !== "all";
    return testers
      .map((t) => {
        const matchingSessions = (t.sessions || []).filter((s) => sessionMatches(s, t));
        return { ...t, _matchingSessions: matchingSessions };
      })
      .filter((t) => {
        if (q) {
          const name = `${t.firstName} ${t.lastName}`.toLowerCase();
          if (!name.includes(q)) return false;
        }
        if (modeFilter && (t.mode || "tester") !== modeFilter) return false;
        if (roleFilter) {
          if (roleFilter === "__none__") {
            if (t.role) return false;
          } else if (t.role !== roleFilter) return false;
        }
        if (sessionFilterActive) {
          // Require at least one matching session if session-level filters
          // are active. Without that, the testers view would show people
          // with zero rows in the expansion.
          if (!t._matchingSessions.length) return false;
        }
        return true;
      });
  }, [testers, search, modeFilter, roleFilter, conditionFilter, statusFilter, dateRange, dateBounds]);

  // Flat sessions view — collect every session across every tester that
  // matches the active filters. Each row carries the tester info so we
  // can display name + role without an extra lookup.
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [];
    for (const t of testers) {
      if (q) {
        const name = `${t.firstName} ${t.lastName}`.toLowerCase();
        if (!name.includes(q)) continue;
      }
      for (const s of t.sessions || []) {
        if (!sessionMatches(s, t)) continue;
        rows.push({
          ...s,
          _testerName: `${t.firstName} ${t.lastName}`,
          _testerId: t.id,
          _testerRole: t.role,
          _testerMode: t.mode || "tester",
        });
      }
    }
    rows.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    return rows;
  }, [testers, search, modeFilter, roleFilter, conditionFilter, statusFilter, dateRange, dateBounds]);

  // Aggregated stats — recomputed from the filtered set so the boxes
  // reflect what the user is currently looking at, not the global total.
  const stats = useMemo(() => {
    return {
      testers: filteredTesters.length,
      sessions: filteredSessions.length,
      completed: filteredSessions.filter((s) => s.completedAt).length,
    };
  }, [filteredTesters, filteredSessions]);

  const exportCSV = () => {
    if (view === "sessions") {
      const rows = filteredSessions.map((s) => ({
        tester: s._testerName,
        mode: s._testerMode,
        role: s._testerRole || "",
        condition: s.condition || "",
        scenario: s.scenarioId || "",
        started: s.startedAt ? new Date(s.startedAt).toISOString() : "",
        completed: s.completedAt ? new Date(s.completedAt).toISOString() : "",
        durationSec: s.completedAt && s.startedAt ? Math.round((s.completedAt - s.startedAt) / 1000) : "",
        turns: s.turns || 0,
        status: s.completedAt ? "completed" : "in-progress",
        feedbackClinical: s.feedback?.clinicalSoundness ?? "",
        feedbackOutcome: s.feedback?.outcomeAccuracy ?? "",
        feedbackUX: s.feedback?.uxRating ?? "",
        feedbackRecommend: s.feedback?.recommend ?? "",
        feedbackWhatBroke: s.feedback?.whatBroke ?? "",
      }));
      downloadCSV(`drneil-sessions-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } else {
      const rows = filteredTesters.map((t) => ({
        firstName: t.firstName,
        lastName: t.lastName,
        mode: t.mode || "tester",
        role: t.role || "",
        totalSessions: t.totalSessions,
        completedSessions: t.completedSessions,
        firstSeen: t.firstSeenAt ? new Date(t.firstSeenAt).toISOString() : "",
        lastSeen: t.lastSeenAt ? new Date(t.lastSeenAt).toISOString() : "",
      }));
      downloadCSV(`drneil-testers-${new Date().toISOString().slice(0,10)}.csv`, rows);
    }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5FBF9", fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
        <form onSubmit={handleLogin} style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #D8F0EA", boxShadow: "0 2px 16px rgba(26,107,91,0.06)", width: 360 }}>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={exportCSV} disabled={loading} style={{ padding: "8px 14px", border: "1.5px solid #1A6B5B", background: "#fff", color: "#1A6B5B", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ⬇ Export CSV
          </button>
          <button type="button" onClick={() => fetchTesters()} disabled={loading} style={{ padding: "8px 14px", border: "1.5px solid #1A6B5B", background: "#fff", color: "#1A6B5B", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 80px" }}>
        {/* Filters */}
        <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 12, padding: "16px", marginBottom: 16, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
          <FilterField label="Search by name">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Chen"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #D8F0EA", fontSize: 13, fontFamily: "inherit" }}
            />
          </FilterField>
          <FilterField label="Mode">
            <Select value={modeFilter} onChange={setModeFilter} options={MODE_FILTER_OPTIONS} />
          </FilterField>
          <FilterField label="Role">
            <Select value={roleFilter} onChange={setRoleFilter} options={ROLE_FILTER_OPTIONS} />
          </FilterField>
          <FilterField label="Condition">
            <Select value={conditionFilter} onChange={setConditionFilter} options={CONDITION_FILTER_OPTIONS} />
          </FilterField>
          <FilterField label="Status">
            <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} />
          </FilterField>
          <FilterField label="Date range">
            <Select value={dateRange} onChange={setDateRange} options={DATE_RANGE_OPTIONS} />
          </FilterField>
          {dateRange === "custom" && (
            <>
              <FilterField label="From">
                <input
                  type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #D8F0EA", fontSize: 13, fontFamily: "inherit" }}
                />
              </FilterField>
              <FilterField label="To">
                <input
                  type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #D8F0EA", fontSize: 13, fontFamily: "inherit" }}
                />
              </FilterField>
            </>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          <ViewTab active={view === "testers"} onClick={() => setView("testers")}>Testers</ViewTab>
          <ViewTab active={view === "sessions"} onClick={() => setView("sessions")}>Sessions</ViewTab>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          <Stat label={view === "sessions" ? "Testers (matching)" : "Testers"} value={stats.testers} />
          <Stat label="Sessions" value={stats.sessions} />
          <Stat label="Completed" value={stats.completed} />
        </div>

        {!testers.length && <p style={{ color: "#506D65" }}>No data yet. Once someone runs through the flow, they'll show up here.</p>}

        {/* Testers view (grouped) */}
        {view === "testers" && testers.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "#E8F3EF", padding: "10px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1A6B5B", letterSpacing: 0.5, display: "grid", gridTemplateColumns: "1.4fr 0.7fr 1fr 70px 70px 1fr 32px", gap: 12 }}>
              <span>Tester</span>
              <span>Mode</span>
              <span>Role</span>
              <span style={{ textAlign: "right" }}>Started</span>
              <span style={{ textAlign: "right" }}>Done</span>
              <span>Last seen</span>
              <span></span>
            </div>
            {filteredTesters.length === 0 && (
              <p style={{ padding: 16, color: "#506D65", margin: 0 }}>No testers match the current filters.</p>
            )}
            {filteredTesters.map((t) => {
              const matchingSessions = t._matchingSessions || t.sessions || [];
              const matchingDone = matchingSessions.filter((s) => s.completedAt).length;
              return (
                <div key={t.id} style={{ borderTop: "1px solid #F0F4F2" }}>
                  <div
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1.4fr 0.7fr 1fr 70px 70px 1fr 32px", gap: 12, alignItems: "center", cursor: "pointer", fontSize: 14, color: "#1F2937" }}
                  >
                    <span style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</span>
                    <ModeBadge mode={t.mode || "tester"} />
                    <span style={{ color: "#506D65" }}>{ROLE_LABELS[t.role] || (t.role || "—")}</span>
                    <span style={{ textAlign: "right" }}>{matchingSessions.length}</span>
                    <span style={{ textAlign: "right", color: matchingDone > 0 ? "#1A6B5B" : "#506D65", fontWeight: matchingDone > 0 ? 600 : 400 }}>{matchingDone}</span>
                    <span style={{ color: "#506D65", fontSize: 13 }}>{fmtDate(t.lastSeenAt)}</span>
                    <span style={{ color: "#506D65", textAlign: "center", transform: expanded === t.id ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>›</span>
                  </div>
                  {expanded === t.id && (
                    <div style={{ background: "#FAFCFB", borderTop: "1px solid #F0F4F2", padding: "12px 16px 16px" }}>
                      {!matchingSessions.length && <p style={{ fontSize: 13, color: "#506D65", margin: 0 }}>No matching sessions.</p>}
                      {matchingSessions.map((s) => {
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
                            {isOpen && <SessionDetail session={s} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sessions view (flat) */}
        {view === "sessions" && testers.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "#E8F3EF", padding: "10px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1A6B5B", letterSpacing: 0.5, display: "grid", gridTemplateColumns: "1.3fr 0.7fr 1fr 1fr 80px 1fr 32px", gap: 12 }}>
              <span>Tester</span>
              <span>Mode</span>
              <span>Scenario</span>
              <span>Started</span>
              <span>Status</span>
              <span>Detail</span>
              <span></span>
            </div>
            {filteredSessions.length === 0 && (
              <p style={{ padding: 16, color: "#506D65", margin: 0 }}>No sessions match the current filters.</p>
            )}
            {filteredSessions.map((s) => {
              const dur = s.completedAt ? s.completedAt - s.startedAt : null;
              const isOpen = openSession === s.id;
              return (
                <div key={s.id} style={{ borderTop: "1px solid #F0F4F2" }}>
                  <div
                    onClick={() => setOpenSession(isOpen ? null : s.id)}
                    style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1.3fr 0.7fr 1fr 1fr 80px 1fr 32px", gap: 12, alignItems: "center", cursor: "pointer", fontSize: 13, color: "#1F2937" }}
                  >
                    <span style={{ fontWeight: 600 }}>{s._testerName}</span>
                    <ModeBadge mode={s._testerMode} />
                    <span style={{ color: "#506D65" }}>{SCENARIO_LABELS[s.scenarioId] || (s.condition ? s.condition.toUpperCase() : "—")}</span>
                    <span style={{ color: "#506D65" }}>{fmtDate(s.startedAt)}</span>
                    <span style={{ color: s.completedAt ? "#1A6B5B" : "#b87600", fontWeight: 600, fontSize: 12 }}>
                      {s.completedAt ? "✓ done" : "in progress"}
                    </span>
                    <span style={{ color: "#506D65" }}>{dur != null ? `${fmtDuration(dur)} · ${s.turns || 0} turns` : `${s.turns || 0} turns`}</span>
                    <span style={{ color: "#506D65", textAlign: "center", transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>›</span>
                  </div>
                  {isOpen && (
                    <div style={{ background: "#FAFCFB", borderTop: "1px solid #F0F4F2", padding: "12px 16px 16px" }}>
                      <SessionDetail session={s} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#506D65", letterSpacing: 0.5 }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #D8F0EA", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ViewTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 18px", minHeight: 36,
        border: "1.5px solid #1A6B5B",
        background: active ? "#1A6B5B" : "#fff",
        color: active ? "#fff" : "#1A6B5B",
        borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function ModeBadge({ mode }) {
  const isPatient = mode === "patient";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      background: isPatient ? "#FFF3E0" : "#E8F3EF",
      color: isPatient ? "#b87600" : "#1A6B5B",
      border: `1px solid ${isPatient ? "#F5D49C" : "#B8DCD0"}`,
      textTransform: "uppercase",
      width: "fit-content",
    }}>
      {isPatient ? "Patient" : "Tester"}
    </span>
  );
}

function SessionDetail({ session }) {
  const fb = session.feedback;
  const transcript = Array.isArray(session.transcript) ? session.transcript : [];
  return (
    <div style={{ background: "#fff", border: "1px solid #D8F0EA", borderRadius: 8, padding: "12px 14px", margin: "0 0 12px" }}>
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
          {session.completedAt ? "No feedback submitted." : "Session in progress — feedback not yet captured."}
        </div>
      )}

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
