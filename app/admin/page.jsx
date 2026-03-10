"use client";

import { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [authed, setAuthed] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const authHeader = "Basic " + btoa(`${credentials.username}:${credentials.password}`);

  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/conversations", {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) {
        setAuthed(false);
        setError("Invalid credentials");
        return;
      }
      const data = await res.json();
      setConversations(data);
      setAuthed(true);
    } catch (err) {
      setError("Failed to load conversations");
    }
    setLoading(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    fetchConversations();
  };

  const conditionColors = {
    bph: { bg: "#D1FAE5", text: "#065F46", label: "BPH" },
    ed: { bg: "#DBEAFE", text: "#1E40AF", label: "ED" },
    mh: { bg: "#FEF3C7", text: "#92400E", label: "MH" },
    unknown: { bg: "#F3F4F6", text: "#374151", label: "Unknown" },
  };

  // ── LOGIN SCREEN ──
  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>
            AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
          </h1>
          <p style={styles.loginSubtitle}>Admin Dashboard</p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder="admin"
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: 14, marginBottom: 12 }}>{error}</p>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? "Loading..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ──
  return (
    <div style={styles.page}>
      <div style={{ maxWidth: 1100, width: "100%", margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif", margin: 0 }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
              <span style={{ fontSize: 16, fontWeight: 400, color: "#506D65", marginLeft: 12 }}>Admin</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={fetchConversations} style={{ ...styles.btnSmall, background: "#1A6B5B", color: "#fff" }}>
              Refresh
            </button>
            <span style={{ fontSize: 14, color: "#506D65" }}>
              {conversations.length} consultation{conversations.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Layout: Table + Detail */}
        <div style={{ display: "flex", gap: 20 }}>

          {/* Conversation List */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {conversations.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={{ fontSize: 17, color: "#506D65", margin: 0 }}>No consultations yet</p>
                <p style={{ fontSize: 14, color: "#547C72", margin: "8px 0 0" }}>
                  Conversations will appear here as patients complete virtual consultations.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {conversations.map((c) => {
                  const cc = conditionColors[c.condition] || conditionColors.unknown;
                  const isSelected = selected?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c)}
                      style={{
                        padding: "16px 18px",
                        background: isSelected ? "#F5FBF9" : "#FFFFFF",
                        border: isSelected ? "2px solid #1A6B5B" : "1px solid #D8F0EA",
                        borderRadius: 12,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>
                            {c.patientInfo?.name || "Unknown Patient"}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 600, marginLeft: 10,
                            padding: "2px 8px", borderRadius: 4,
                            background: cc.bg, color: cc.text,
                          }}>
                            {cc.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, color: "#506D65" }}>
                          {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : "—"}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: "#506D65", marginTop: 4 }}>
                        {c.messages?.length || 0} messages · ID: {c.id?.slice(-8)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div style={{
              width: 480, background: "#FFFFFF", borderRadius: 14,
              border: "1px solid #D8F0EA", padding: "24px 20px",
              maxHeight: "80vh", overflowY: "auto", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1F2937", margin: 0, fontFamily: "'Georgia', serif" }}>
                  {selected.patientInfo?.name || "Unknown"}
                </h2>
                <button onClick={() => setSelected(null)} style={{ ...styles.btnSmall, background: "#F5FBF9", color: "#506D65" }}>
                  Close
                </button>
              </div>

              {/* Patient Info */}
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "#F5FBF9", borderRadius: 10, border: "1px solid #D8F0EA" }}>
                <h4 style={styles.sectionTitle}>Patient Info</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 14 }}>
                  <span style={{ color: "#506D65" }}>Age: <strong style={{ color: "#1F2937" }}>{selected.patientInfo?.age || "—"}</strong></span>
                  <span style={{ color: "#506D65" }}>Sex: <strong style={{ color: "#1F2937" }}>{selected.patientInfo?.sex || "—"}</strong></span>
                  <span style={{ color: "#506D65" }}>MRN: <strong style={{ color: "#1F2937" }}>{selected.patientInfo?.mrn || "—"}</strong></span>
                  <span style={{ color: "#506D65" }}>Condition: <strong style={{ color: "#1F2937" }}>{selected.condition?.toUpperCase()}</strong></span>
                </div>
              </div>

              {/* Transcript */}
              <div>
                <h4 style={styles.sectionTitle}>Consultation Transcript</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.messages
                    ?.filter((m) => !m.content?.includes("PATIENT REFERRAL DATA"))
                    .map((m, i) => (
                    <div key={i} style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: m.role === "user" ? "#1A6B5B" : "#F5FBF9",
                      color: m.role === "user" ? "#FFFFFF" : "#1F2937",
                      border: m.role === "user" ? "none" : "1px solid #D8F0EA",
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}>
                      <strong style={{ fontSize: 12, opacity: 0.7 }}>
                        {m.role === "user" ? "PATIENT" : "DR. FLESHNER"}
                      </strong>
                      <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F5FBF9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  loginCard: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: "40px 36px",
    maxWidth: 380,
    width: "100%",
    border: "1px solid #D8F0EA",
    boxShadow: "0 2px 16px rgba(26, 107, 91, 0.06)",
  },
  loginTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 4px",
    fontFamily: "'Georgia', serif",
    textAlign: "center",
  },
  loginSubtitle: {
    fontSize: 14,
    color: "#506D65",
    textAlign: "center",
    marginBottom: 28,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    border: "1.5px solid #D8F0EA",
    borderRadius: 10,
    fontSize: 16,
    outline: "none",
    background: "#F5FBF9",
    color: "#1F2937",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: "16px 0",
    background: "#1A6B5B",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSmall: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #D8F0EA",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #D8F0EA",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#506D65",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 0,
  },
};
