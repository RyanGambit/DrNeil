"use client";

import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════
// CONDITION DETECTION — Reads referral to determine which prompt to use
// ═══════════════════════════════════════════════════════════════════════
function detectCondition(referralReason, medicalHistory) {
  const text = ((referralReason || "") + " " + (medicalHistory || "")).toLowerCase();

  // BPH / LUTS keywords
  const bphKeywords = [
    "bph", "luts", "lower urinary tract", "urinary frequency",
    "nocturia", "hesitancy", "weak stream", "dribbling",
    "prostatic hyperplasia", "voiding", "urinary symptoms",
    "incomplete emptying", "straining", "intermittency",
    "post-void residual", "benign prostate",
  ];

  // Erectile Dysfunction keywords — expanded
  const edKeywords = [
    "erectile dysfunction", "erectile", "impotence",
    "sexual dysfunction", "erection", "erections",
    "difficulty with erection", "difficulty getting",
    "difficulty maintaining", "unable to maintain",
    "libido", "sexual function", "sexual health",
    "pde5", "viagra", "cialis", "sildenafil", "tadalafil",
    "can't get hard", "trouble getting hard",
    "performance", "intimacy concerns",
  ];

  // Microhematuria keywords
  const mhKeywords = [
    "hematuria", "microhematuria", "blood in urine", "rbc in urine",
    "red blood cells", "microscopic blood", "microscopic hematuria",
    "urine blood", "dipstick positive", "blood in the urine",
    "rbc", "hemoglobin in urine",
  ];

  const bphScore = bphKeywords.filter((k) => text.includes(k)).length;
  const edScore = edKeywords.filter((k) => text.includes(k)).length;
  const mhScore = mhKeywords.filter((k) => text.includes(k)).length;

  // Also check for standalone "ED" (case-sensitive since it's an abbreviation)
  const rawText = ((referralReason || "") + " " + (medicalHistory || ""));
  if (/\bED\b/.test(rawText)) {
    // Only count if not part of another word
    return edScore + 2 >= bphScore && edScore + 2 >= mhScore ? "ed" : 
           bphScore > mhScore ? "bph" : mhScore > 0 ? "mh" : "ed";
  }

  if (bphScore >= edScore && bphScore >= mhScore && bphScore > 0) return "bph";
  if (edScore >= bphScore && edScore >= mhScore && edScore > 0) return "ed";
  if (mhScore >= bphScore && mhScore >= edScore && mhScore > 0) return "mh";

  return "unknown";
}

const CONDITION_LABELS = {
  bph: "BPH / Lower Urinary Tract Symptoms",
  ed: "Erectile Dysfunction",
  mh: "Microhematuria",
  unknown: "Unclassified — Requires Review",
};


// ═══════════════════════════════════════════════════════════════════════
// DR. FLESHNER AVATAR (base64)
// ═══════════════════════════════════════════════════════════════════════
const DR_AVATAR = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCABgAGADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBlLilApwFUSNxS4p2KZPKkELSP0HYdz6UAKcAZJwKqtqFmrbTOuf0qrP5t7Iq7HYbsMgbhfw71Y/sotCVKMSAcE/pUuSRSi2Sm7tlYAzICfepRhgCpBB6EVnDSnER3A4BwvHamQyppsoieQ+VjkH+HngimncTTRqYoxTyKQimIZikNOxSYoGSgUtFLigQlU2BvNQ+zpyIhyc9Gq9/KoPDkeb+SQtlXY4z3pMaNOwsobZAiLz1JPUmtVIMp0FVl2pckdqvx7yvBArl3Z2rRaFC5hCAnA4rmb+GOW5DMoyp7jtXX3KhkIZh/jXM6hCsc6sSACcEHvQrphJJxKtnIVd7dyDsPynParlZ8URF9FKAyiQAkHoTjn8a0sV1I4hhFJinUGmIcKdikxTgKBkdwD9nkx12motNY2sbT4DFfljQepOKt44qks6mRoomQlDkbe2Ov41MnYcVd2LRmuYJJJZZnPz/KoHzAY6dPWoi2ryzKymWNCRhXcZP5dK1bYrMCGAyTkH0qwztFII0SNnboByceprn5jr5ChqS3C6WZEI81DlifeuVawvHUSkrIzEHG05Nd1NJamCdJZkJC/Nn1rmrHUkaOREdGQEgNjg0JtD5E2EFksahjlWBDDb+v9KuY4qjBqAnuxE2D8oHyjjPNaGK6Y7HHJWZGRSEVJTSKZI8ClAoApwFAxDwpJ6AZrnlvVsdaS5JDx+YfkUYJBroyMqR61x2oWM9rd4kSRwW3B1Bbd+P9KTVxp2dzsLKZLqMy278Ell/PpVq3EtuSyxtMzEF33DP5egrM0qwu7DS4HkBBfLopGDj0Pv3rSsLtPMwWBDdvSuRrllY7Yvmjck1OCO7sirxhh6eYBmuNhhAubhXQRQxqcfNnJrt7yHzUGyYqvoBXH38AmvI7G2cs5cs7N/Wr30Qnork2jxF53lJKpyyr2Oe9bGKrabZfYrYRs5dz1Yn9B7VbxXQlZWONu7uRkU0ipSKaRTEKBTgKQU2W4igXMjc9gOpoAlAqpcTCQGOI8fxEd/aqlxeSzZUfInpTbd9uVJyc0AdZo9zFfWf2OcfOg49x6j3FZ+q6FJAxnhJK5zuXt9fSs2GZ4ZVliYq6HKkdq7PTL+PULbeuFkXh09D/AIVE4KRcKjicDdzXkcRCznFZWlvImrQMDl5JNp+mCTXoGu6DHdoWtsRSkc8fKfw7Vy2j6PPHqcs96BGbMYRCRlmP8X0x396iMWmaSmpLQ1IpoZxmGVHx12nOKfiuHaOaNyx3RzKfm5xk1p2Gt3MZCzHzl/2uCPxrYwOkIpCKrW2qW1w6p8yO3ADdCfTNXCKAKdzclF2wgM3c9lrNKszFmOWPUmragbSc/lUMg2ncOnf2oAZgAU0sFwcgHPGe9OYfSkZFePBAPPegROre/B6Vb029axukkDHZnD49PWs5AEwoJNPB9RQB3d5qcFpYNdSAuduVVRkyE9AK4DUriY3C6oj5lDbmI6Y7j6V02gXQuLdrGbBaP5oyfT/61Y+sQrHqc0SIBGwAZR7jrVw7CkQ6zFHOkV5Gm3cNrjHHqDnuKwnhAkDDj1xXS6IRd6TLYSH54jsGeo/un+lYVzGyuUPysp7ipatoMqyMUVsZBAyPYjmuwspTc2UMx6ugJ+tchKpAAbkEba6LwzJ5ukKveNiv9aQI/9k=";

// ═══════════════════════════════════════════════════════════════════════
// PARSE UPLOADED PATIENT FILE
// ═══════════════════════════════════════════════════════════════════════
function parsePatientFile(text) {
  const data = {};
  
  // Smart extractor — tries multiple labels, handles multi-line indented values
  const extract = (...labels) => {
    for (const label of labels) {
      const regex = new RegExp(label + "[:\\\\s]+([^\\n]+(?:\\n\\s{2,}[^\\n]+)*)", "i");
      const match = text.match(regex);
      if (match) {
        const val = match[1].replace(/\\s+/g, " ").trim();
        if (val && !val.startsWith("═") && !val.startsWith("─") && val.length > 0) return val;
      }
    }
    return null;
  };

  // Section extractor — gets content between section dividers
  const extractSection = (...names) => {
    for (const name of names) {
      const regex = new RegExp(name + "[\\\\s═─]*\\n([\\\\s\\\\S]*?)(?=\\n═|\\n──|$)", "i");
      const match = text.match(regex);
      if (match && match[1].trim()) return match[1].trim();
    }
    return null;
  };

  // ── Common demographics ──
  data.name = extract("Patient Name", "Name");
  data.age = extract("Age");
  data.sex = extract("Sex");
  data.mrn = extract("MRN", "Health Card");
  data.language = extract("Primary language");
  data.pcp = extract("Primary Care Physician", "Referring Physician", "Family Physician");
  
  data.referralType = extract("Referral Type");
  data.referralDate = extract("Referral Date");
  
  // Flexible referral reason
  const reasonQuoted = text.match(/Reason for referral[^"]*"([^"]+)"/s);
  const reasonUnquoted = text.match(/Reason for referral[:\s]+([^\n]+(?:\n\s{2,}[^\n]+)*)/i);
  data.referralReason = reasonQuoted 
    ? reasonQuoted[1].replace(/\s+/g, " ").trim() 
    : reasonUnquoted ? reasonUnquoted[1].replace(/\s+/g, " ").trim() : null;

  // ── BPH fields ──
  const psaMatch = text.match(/PSA\s*\([^)]+\)[:\s]+(.+)/i);
  data.psa = psaMatch ? psaMatch[1].trim() : extract("PSA");
  data.freePsa = extract("Free/Total PSA ratio", "Free PSA");
  
  const uaMatch = text.match(/Urinalysis\s*\([^)]+\)[:\s]+(.+)/i);
  data.ua = uaMatch ? uaMatch[1].trim() : null;
  if (!data.ua) {
    const rbcVal = extract("RBC");
    if (rbcVal) data.ua = rbcVal + " (microscopy)";
  }
  
  data.creatinine = extract("Serum Creatinine", "Creatinine");
  data.egfr = extract("eGFR");

  const prostateMatch = text.match(/Prostate volume[:\s]+(.+)/i);
  data.prostateVolume = prostateMatch ? prostateMatch[1].trim() : null;
  
  const pvrMatch = text.match(/Post-void residual[:\s]+(.+)/i);
  data.pvr = pvrMatch ? pvrMatch[1].trim() : null;

  // ── ED fields ──
  data.testosterone = extract("Testosterone", "Total testosterone", "Serum testosterone");
  data.fastingGlucose = extract("Fasting glucose", "Glucose");
  data.hba1c = extract("HbA1C", "HbA1c", "A1C");
  data.lipids = extract("Lipid", "Cholesterol", "LDL");
  
  const priorEdMatch = text.match(/Prior ED treatment[s]?[:\s]+(.+)/i) 
    || text.match(/Previous treatment[s]?[:\s]+(.+)/i)
    || text.match(/PDE5i[:\s]+(.+)/i);
  data.priorEdTreatment = priorEdMatch ? priorEdMatch[1].trim() : null;
  data.edDuration = extract("ED duration", "Duration of ED", "Duration of symptoms");
  data.edSeverity = extract("Severity", "ED severity");

  // ── MH fields ──
  const rbcMatch = text.match(/RBC[:\s]+(\d+)\s*(?:\/HPF)?/i);
  data.rbcHpf = rbcMatch ? rbcMatch[1] + " RBC/HPF" : null;
  
  const cultureMatch = text.match(/Urine Culture[\s\S]*?Result[:\s]+(.+)/i);
  data.urineCulture = cultureMatch ? cultureMatch[1].trim() : extract("Culture result", "Culture");
  
  data.priorImaging = extract("Prior Imaging");
  data.proteinuria = extract("Proteinuria", "Protein(?!uria)");
  data.dipstick = extract("Dipstick Blood", "Dipstick");
  data.uaMethod = extract("Method");

  // ── Allergies ──
  data.allergies = extract("Allergies") || "None known";

  // ── Medical history ──
  const medHistRaw = extract("Active Conditions") || extractSection("5\\. Medical History", "MEDICAL HISTORY");
  if (medHistRaw) {
    data.medicalHistory = medHistRaw.split(/[,\n]/).map(l => l.replace(/^[●\-\s\d.]+/, "").trim()).filter(l => l && !l.startsWith("═"));
  }

  // ── Surgical history ──
  const surgRaw = extract("Prior Surgeries") || extractSection("6\\. Surgical History", "SURGICAL HISTORY");
  if (surgRaw) {
    data.surgicalHistory = surgRaw.split(/\n/).map(l => l.replace(/^[●\-\s\d.]+/, "").trim()).filter(l => l && !l.startsWith("═"));
  }

  // ── Medications ──
  const medsRaw = extractSection("CURRENT MEDICATIONS", "8\\. Current Medications");
  if (medsRaw) {
    data.medications = medsRaw.split("\n").map(l => l.replace(/^[●\-\s\d.]+/, "").trim()).filter(l => l && !l.startsWith("═") && l.length > 2);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// SIMPLE MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return "";
  return text
    // Headers → bold text on its own line
    .replace(/^#{1,3}\s+(.+)$/gm, "<strong>$1</strong>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    // Bullet points → clean lines
    .replace(/^[-•]\s+/gm, "  · ")
    // Lettered options (keep as-is, they're already formatted)
    // Double newlines → paragraph breaks
    .replace(/\n\n/g, "<br/><br/>")
    // Single newlines → line breaks
    .replace(/\n/g, "<br/>");
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function AskDrFleshner() {
  const [step, setStep] = useState("welcome"); // welcome | upload | waiting | chat | soap
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [rawFileText, setRawFileText] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [detectedCondition, setDetectedCondition] = useState(null);
  const [waitingStep, setWaitingStep] = useState(0);
  const [soapNote, setSoapNote] = useState("");
  const [soapLoading, setSoapLoading] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [clinicalState, setClinicalState] = useState(null);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [conversationId] = useState(() => `consult-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialContextRef = useRef("");

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Waiting room animation
  const waitingSteps = [
    { label: "Verifying patient records", icon: "🔍" },
    { label: "Reviewing test results", icon: "📋" },
    { label: "Preparing your consultation", icon: "💬" },
    { label: "Dr. Fleshner is ready for you", icon: "✓" },
  ];

  useEffect(() => {
    if (step !== "waiting") return;
    if (waitingStep < waitingSteps.length - 1) {
      const timer = setTimeout(() => setWaitingStep((s) => s + 1), 1800);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => launchChat(), 1200);
      return () => clearTimeout(timer);
    }
  }, [step, waitingStep]);

  // ── LIVE CLINICAL ANALYSIS (fires after each assistant message) ──
  useEffect(() => {
    if (step !== "chat" || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    const analyzeConversation = async () => {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "PATIENT" : "CLINICIAN"}: ${m.text}`)
        .join("\n\n");


      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            condition: detectedCondition,
            patientContext: initialContextRef.current,
          }),
        });

        const parsed = await response.json();
        if (parsed && typeof parsed === "object" && !parsed.error) setClinicalState(parsed);
      } catch (err) {
        console.error("Clinical analysis error:", err);
      }
    };

    analyzeConversation();
  }, [messages]);


  // ── WELCOME SCREEN (Landing Page) ──
  if (step === "welcome") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5FBF9" }}>

        {/* ── HEADER ── */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "#FFFFFF",
          borderBottom: "1px solid #D8F0EA",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={DR_AVATAR} alt="Dr. Fleshner" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #1A6B5B" }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span style={{ fontSize: 14, color: "#506D65" }}>About</span>
            <span style={{ fontSize: 14, color: "#506D65" }}>Contact</span>
          </div>
        </header>

        {/* ── HERO + FORM ── */}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>

            <p style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1A6B5B",
              textTransform: "uppercase",
              letterSpacing: 1.5,
              margin: "0 0 12px",
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
            }}>
              Virtual Urology Consultation
            </p>

            <h1 style={{
              fontSize: 38,
              fontWeight: 700,
              color: "#1F2937",
              margin: "0 0 16px",
              fontFamily: "'Georgia', serif",
              lineHeight: 1.2,
              letterSpacing: -0.5,
            }}>
              Welcome to<br />AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </h1>

            <p style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: "#4B5563",
              margin: "0 auto 36px",
              maxWidth: 420,
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
            }}>
              A virtual consultation experience with Dr. Neil Fleshner's urology practice.
            </p>

            {/* ── Form Card ── */}
            <div style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: "32px 32px 28px",
              textAlign: "left",
              border: "1px solid #D8F0EA",
              boxShadow: "0 2px 16px rgba(26, 107, 91, 0.06)",
            }}>
              <p style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1F2937",
                margin: "0 0 20px",
                fontFamily: "-apple-system, 'Segoe UI', sans-serif",
              }}>
                Enter your details to begin
              </p>

              <div style={styles.formGroup}>
                <label style={styles.label}>First Name</label>
                <input
                  style={styles.input}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Michael"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Last Name</label>
                <input
                  style={styles.input}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Tran"
                />
              </div>

              <button
                style={{
                  ...styles.primaryBtn,
                  opacity: firstName && lastName ? 1 : 0.4,
                  cursor: firstName && lastName ? "pointer" : "not-allowed",
                }}
                disabled={!firstName || !lastName}
                onClick={() => setStep("upload")}
              >
                Start Your Session
              </button>
            </div>

            <p style={{
              fontSize: 13,
              color: "#506D65",
              marginTop: 20,
              lineHeight: 1.5,
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
            }}>
              This is a demonstration tool for educational purposes only. Not for clinical use.
            </p>
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: "28px 32px",
          background: "#FFFFFF",
          borderTop: "1px solid #D8F0EA",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </span>
            
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <span style={{ fontSize: 13, color: "#506D65" }}>Privacy Policy</span>
            <span style={{ fontSize: 13, color: "#506D65" }}>Terms of Use</span>
            <span style={{ fontSize: 13, color: "#506D65" }}>Accessibility</span>
          </div>
          <div style={{ fontSize: 13, color: "#506D65" }}>
            © {new Date().getFullYear()} Dr. Neil Fleshner. All rights reserved.
          </div>
        </footer>
      </div>
    );
  }

  // ── UPLOAD & VALIDATE SCREEN ──
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setRawFileText(text);
      const parsed = parsePatientFile(text);
      setPatientData(parsed);
      const condition = detectCondition(
        parsed.referralReason,
        parsed.medicalHistory?.join(" ")
      );
      setDetectedCondition(condition);
      setFileUploaded(true);
    };
    reader.readAsText(file);
  };

  const startChat = () => {
    setWaitingStep(0);
    setStep("waiting");
  };

  const launchChat = () => {
    setStep("chat");

    // Build condition-specific patient context
    const d = patientData;
    const name = d.name || `${firstName} ${lastName}`;

    // Common fields for all conditions
    let context = `PATIENT REFERRAL DATA:
- Name: ${name}
- Age: ${d.age || "Unknown"}
- Sex: ${d.sex || "Unknown"}
- MRN: ${d.mrn || "Unknown"}
- Primary Care Physician: ${d.pcp || "Unknown"}
- Referral Reason: ${d.referralReason || "Not specified"}
- Medical History: ${d.medicalHistory?.join(", ") || "None listed"}
- Surgical History: ${d.surgicalHistory?.join(", ") || "None listed"}
- Allergies: ${d.allergies || "None known"}
- Medications: ${d.medications?.join(", ") || "None listed"}`;

    // Condition-specific fields
    if (detectedCondition === "bph") {
      context += `
- PSA: ${d.psa || "Not available"}
- Free/Total PSA: ${d.freePsa || "Not available"}
- Urinalysis: ${d.ua || "Not available"}
- Creatinine: ${d.creatinine || "Not available"}
- eGFR: ${d.egfr || "Not available"}
- Prostate Volume: ${d.prostateVolume || "Not available"}
- Post-void Residual: ${d.pvr || "Not available"}`;
    } else if (detectedCondition === "ed") {
      context += `
- Testosterone: ${d.testosterone || "Not available"}
- Fasting Glucose: ${d.fastingGlucose || "Not available"}
- HbA1C: ${d.hba1c || "Not available"}
- Lipids: ${d.lipids || "Not available"}
- PSA: ${d.psa || "Not available"}
- Prior ED Treatments: ${d.priorEdTreatment || "None documented"}
- ED Duration: ${d.edDuration || "Not specified"}
- ED Severity: ${d.edSeverity || "Not specified"}`;
    } else if (detectedCondition === "mh") {
      context += `
- Urinalysis RBC/HPF: ${d.rbcHpf || "Not available"}
- UA Method: ${d.uaMethod || "Not specified"}
- Dipstick Blood: ${d.dipstick || "Not available"}
- Proteinuria: ${d.proteinuria || "Not noted"}
- Urine Culture: ${d.urineCulture || "Not available"}
- Serum Creatinine: ${d.creatinine || "Not available"}
- eGFR: ${d.egfr || "Not available"}
- Prior Imaging: ${d.priorImaging || "None documented"}`;
    } else {
      // Unknown — send everything we have
      context += `
- PSA: ${d.psa || "Not available"}
- Urinalysis: ${d.ua || "Not available"}
- Creatinine: ${d.creatinine || "Not available"}
- Testosterone: ${d.testosterone || "Not available"}`;
    }

    context += `\n\nBEGIN the consultation now. Review the patient data above and deliver your opening message. The patient's first name is ${firstName}.`;

    initialContextRef.current = context;
    sendToAPI([], context, false);
  };

  if (step === "upload") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5FBF9" }}>
        {/* ── HEADER ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 32px", background: "#FFFFFF", borderBottom: "1px solid #D8F0EA",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setStep("welcome")}>
            <img src={DR_AVATAR} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #1A6B5B" }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </span>
          </div>
          <button style={styles.backBtn} onClick={() => setStep("welcome")}>← Back to Home</button>
        </header>

        {/* ── CONTENT ── */}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
        <div style={styles.uploadCard}>
          <div style={styles.uploadHeader}>
            <h2 style={styles.uploadTitle}>Upload Referral Information</h2>
            <p style={styles.uploadSubtitle}>
              Hi {firstName}, please upload your patient referral file so Dr. Fleshner can review your information before the consultation.
            </p>
          </div>

          <div
            style={{
              ...styles.dropZone,
              borderColor: fileUploaded ? "#1A6B5B" : "#D8F0EA",
              background: fileUploaded ? "rgba(26, 107, 91, 0.06)" : "#F5FBF9",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            {fileUploaded ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                <p style={{ color: "#1A6B5B", fontWeight: 600, margin: 0, fontSize: 16 }}>File uploaded successfully</p>
                <p style={{ color: "#4B5563", fontSize: 13, margin: "4px 0 0" }}>Click to replace</p>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>📄</div>
                <p style={{ color: "#374151", fontWeight: 500, margin: 0, fontSize: 16 }}>Click to upload your referral file</p>
                <p style={{ color: "#506D65", fontSize: 14, margin: "4px 0 0" }}>.txt files accepted</p>
              </div>
            )}
          </div>

          {patientData && (
            <div style={styles.validationPanel}>
              <h3 style={styles.validationTitle}>Patient Information Verified</h3>

              {detectedCondition && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: detectedCondition === "unknown" ? "#EEF3F8" : "rgba(26, 107, 91, 0.06)",
                  border: `1px solid ${detectedCondition === "unknown" ? "#3D5D80" : "#1A6B5B"}`,
                  borderRadius: 8,
                  marginBottom: 14,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: detectedCondition === "unknown" ? "#3D5D80" : "#1A6B5B",
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  }}>
                    Detected Condition
                  </span>
                  <span style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1F2937",
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  }}>
                    {CONDITION_LABELS[detectedCondition]}
                  </span>
                </div>
              )}
              
              <div style={styles.validationGrid}>
                {/* Common fields for all conditions */}
                <ValidationItem label="Patient" value={patientData.name} />
                <ValidationItem label="Age" value={patientData.age} />
                <ValidationItem label="Sex" value={patientData.sex} />
                <ValidationItem label="MRN" value={patientData.mrn} />
                <ValidationItem label="PCP" value={patientData.pcp} />
                <ValidationItem label="Allergies" value={patientData.allergies} />

                {/* BPH-specific fields */}
                {detectedCondition === "bph" && <div style={{ display: "contents" }}>
                  <ValidationItem label="PSA" value={patientData.psa} />
                  <ValidationItem label="Urinalysis" value={patientData.ua} />
                  <ValidationItem label="Prostate Vol." value={patientData.prostateVolume} />
                  <ValidationItem label="PVR" value={patientData.pvr} />
                </div>}

                {/* ED-specific fields */}
                {detectedCondition === "ed" && <div style={{ display: "contents" }}>
                  <ValidationItem label="Testosterone" value={patientData.testosterone} />
                  <ValidationItem label="Fasting Glucose" value={patientData.fastingGlucose} />
                  <ValidationItem label="HbA1C" value={patientData.hba1c} />
                  <ValidationItem label="Lipids" value={patientData.lipids} />
                  <ValidationItem label="Prior ED Tx" value={patientData.priorEdTreatment} />
                  <ValidationItem label="PSA" value={patientData.psa} />
                </div>}

                {/* MH-specific fields */}
                {detectedCondition === "mh" && <div style={{ display: "contents" }}>
                  <ValidationItem label="RBC/HPF" value={patientData.rbcHpf} />
                  <ValidationItem label="UA Method" value={patientData.uaMethod} />
                  <ValidationItem label="Dipstick" value={patientData.dipstick} />
                  <ValidationItem label="Proteinuria" value={patientData.proteinuria} />
                  <ValidationItem label="Urine Culture" value={patientData.urineCulture} />
                  <ValidationItem label="Creatinine" value={patientData.creatinine} />
                  <ValidationItem label="eGFR" value={patientData.egfr} />
                  <ValidationItem label="Prior Imaging" value={patientData.priorImaging} />
                </div>}

                {/* Unknown - show everything we have */}
                {detectedCondition === "unknown" && <div style={{ display: "contents" }}>
                  <ValidationItem label="PSA" value={patientData.psa} />
                  <ValidationItem label="Urinalysis" value={patientData.ua} />
                  <ValidationItem label="Creatinine" value={patientData.creatinine} />
                </div>}
              </div>

              {patientData.referralReason && (
                <div style={styles.referralBox}>
                  <span style={styles.referralLabel}>Referral Reason</span>
                  <p style={styles.referralText}>{patientData.referralReason}</p>
                </div>
              )}

              {patientData.medications?.length > 0 && (
                <div style={styles.medsBox}>
                  <span style={styles.referralLabel}>Current Medications</span>
                  <p style={styles.referralText}>{patientData.medications.join(" · ")}</p>
                </div>
              )}
            </div>
          )}

          <button
            style={{
              ...styles.primaryBtn,
              opacity: patientData ? 1 : 0.4,
              cursor: patientData ? "pointer" : "not-allowed",
              marginTop: 16,
            }}
            disabled={!patientData}
            onClick={startChat}
          >
            Begin Virtual Consultation
          </button>
        </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: "24px 32px", background: "#FFFFFF", borderTop: "1px solid #D8F0EA",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
            AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
          </span>
          <span style={{ fontSize: 13, color: "#506D65" }}>© {new Date().getFullYear()} Dr. Neil Fleshner</span>
        </footer>
      </div>
    );
  }

  // ── WAITING ROOM SCREEN ──
  if (step === "waiting") {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.waitingCard}>
          <div style={styles.waitingAvatarWrap}>
            <img src={DR_AVATAR} alt="Dr. Fleshner" style={styles.waitingAvatar} />
            <div style={{
              ...styles.waitingPulse,
              animation: "waitPulse 2s ease-in-out infinite",
            }} />
          </div>

          <h2 style={styles.waitingTitle}>Virtual Waiting Room</h2>
          <p style={styles.waitingSubtitle}>
            Please hold — your {CONDITION_LABELS[detectedCondition] || "urology"} consultation will begin shortly.
          </p>

          <div style={styles.waitingSteps}>
            {waitingSteps.map((ws, i) => (
              <div
                key={i}
                style={{
                  ...styles.waitingStepRow,
                  opacity: i <= waitingStep ? 1 : 0.25,
                  transform: i <= waitingStep ? "translateX(0)" : "translateX(8px)",
                  transition: "all 0.5s ease",
                }}
              >
                <span style={{
                  ...styles.waitingStepIcon,
                  background: i < waitingStep ? "#1A6B5B" : i === waitingStep ? "#fff" : "#F5FBF9",
                  color: i < waitingStep ? "#fff" : i === waitingStep ? "#1A6B5B" : "#D8F0EA",
                  border: i === waitingStep ? "2px solid #1A6B5B" : "2px solid transparent",
                }}>
                  {i < waitingStep ? "✓" : ws.icon}
                </span>
                <span style={{
                  ...styles.waitingStepLabel,
                  color: i <= waitingStep ? "#1F2937" : "#547C72",
                  fontWeight: i === waitingStep ? 600 : 400,
                }}>
                  {ws.label}
                </span>
              </div>
            ))}
          </div>

          <div style={styles.waitingProgressTrack}>
            <div style={{
              ...styles.waitingProgressFill,
              width: `${((waitingStep + 1) / waitingSteps.length) * 100}%`,
              transition: "width 0.8s ease",
            }} />
          </div>
        </div>
      </div>
    );
  }

  // ── CHAT SCREEN ──
  async function sendToAPI(history, userMessage, showUserMsg = true) {
    setIsLoading(true);

    // Show user message immediately (except for the initial context message)
    if (showUserMsg) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: userMessage, time: new Date() },
      ]);
    }
    
    // Build API messages — always start with patient context
    const contextMsg = initialContextRef.current
      ? [{ role: "user", content: initialContextRef.current }]
      : [];

    const historyMsgs = history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));

    // For initial call, context IS the user message. For subsequent, prepend it.
    const apiMessages = showUserMsg
      ? [...contextMsg, ...historyMsgs, { role: "user", content: userMessage }]
      : [{ role: "user", content: userMessage }];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          condition: detectedCondition || "unknown",
          conversationId,
          patientInfo: patientData,
        }),
      });

      const data = await response.json();
      const assistantText = data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "I'm sorry, I had trouble processing that. Could you try again?";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: assistantText, time: new Date() },
      ]);
    } catch (err) {
      console.error("API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          time: new Date(),
        },
      ]);
    }

    setIsLoading(false);
  }


  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput("");
    sendToAPI(messages, userText);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── SOAP NOTE GENERATION ──
  const endConsultation = async () => {
    setSoapLoading(true);
    setStep("soap");

    const conversationLog = messages
      .map((m) => `${m.role === "user" ? "PATIENT" : "DR. FLESHNER"}: ${m.text}`)
      .join("\n\n");

    const soapPrompt = `You are a clinical documentation assistant. Based on the following virtual urology consultation transcript and patient referral data, generate a complete SOAP note.

PATIENT REFERRAL DATA:
${initialContextRef.current}

CONSULTATION TRANSCRIPT:
${conversationLog}

Generate a structured SOAP note with these sections. Use proper clinical language and be thorough:

S (Subjective):
- Chief complaint and HPI
- IPSS score and individual question scores (if administered)
- QoL score
- Phenotype identified
- Symptom timeline and trajectory
- Impact in patient's words
- Treatment preference

O (Objective):
- PSA value and date
- Urinalysis and date
- Imaging findings (prostate volume, PVR)
- DRE findings if available
- Current medications (confirmed)
- Allergies (confirmed)
- Medication safety gate responses (if asked)

A (Assessment):
- Clinical impression
- IPSS severity classification
- Phenotype classification
- Risk stratification
- Eligibility for virtual prescription

P (Plan):
- Outcome chosen and rationale
- Intervention details
- Realistic expectations documented
- Follow-up timing
- Safety net documented

Format the output with clear section headers. Be specific and clinical.`;

    try {
      const response = await fetch("/api/soap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: conversationLog,
          patientContext: initialContextRef.current,
          condition: detectedCondition,
        }),
      });

      const data = await response.json();
      setSoapNote(data.note || "Unable to generate SOAP note. Please try again.");
    } catch (err) {
      console.error("SOAP generation error:", err);
      setSoapNote("Error generating SOAP note. Please try again.");
    }

    setSoapLoading(false);
  };

  // ── EMAIL SOAP NOTE ──
  const sendSoapEmail = async () => {
    if (!doctorEmail.trim()) return;
    setEmailSending(true);

    const patientName = patientData?.name || `${firstName} ${lastName}`;
    const subject = `SOAP Note — Virtual Consultation — ${patientName}`;
    const body = `Dr. Fleshner,\n\nPlease find the SOAP note from the virtual BPH consultation with ${patientName} below.\n\n${"═".repeat(60)}\n\n${soapNote}\n\n${"═".repeat(60)}\n\nGenerated by AskDrFleshner Virtual Consultation Platform\nThis is a demonstration — not for clinical use.`;

    try {
      const encodedSubject = encodeURIComponent(subject);
      const emailBody = encodeURIComponent(body);
      window.open(`mailto:${doctorEmail}?subject=${encodedSubject}&body=${emailBody}`, "_blank");
      setEmailSent(true);
    } catch (err) {
      console.error("Email error:", err);
    }

    setEmailSending(false);
  };

  // Filter out the initial context message from display
  const displayMessages = messages;

  // ── SOAP NOTE SCREEN ──
  if (step === "soap") {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.soapCard}>
          <div style={styles.soapHeader}>
            <img src={DR_AVATAR} alt="Dr. Fleshner" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid #1A6B5B" }} />
            <div>
              <h2 style={styles.soapTitle}>Consultation Complete</h2>
              <p style={styles.soapSubtitle}>
                SOAP Note — {patientData?.name || `${firstName} ${lastName}`} · {new Date().toLocaleDateString("en-CA")}
              </p>
            </div>
          </div>

          {soapLoading ? (
            <div style={styles.soapLoadingWrap}>
              <div style={styles.soapSpinner} />
              <p style={{ color: "#4B5563", fontSize: 15, marginTop: 16 }}>
                Generating clinical documentation...
              </p>
            </div>
          ) : (
            <div style={{ display: "contents" }}>
              <div style={styles.soapNoteBox}>
                <pre style={styles.soapNoteText}>{soapNote}</pre>
              </div>

              <div style={styles.soapEmailSection}>
                <h3 style={styles.soapEmailTitle}>Send to Physician</h3>

                {emailSent ? (
                  <div style={styles.soapSentBanner}>
                    <span style={{ fontSize: 20 }}>✓</span>
                    <span>SOAP note sent to {doctorEmail}</span>
                  </div>
                ) : (
                  <div style={{ display: "contents" }}>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        value={doctorEmail}
                        onChange={(e) => setDoctorEmail(e.target.value)}
                        placeholder="doctor@email.com"
                        type="email"
                      />
                      <button
                        style={{
                          ...styles.primaryBtn,
                          width: "auto",
                          padding: "12px 24px",
                          marginTop: 0,
                          opacity: doctorEmail.trim() && !emailSending ? 1 : 0.4,
                        }}
                        onClick={sendSoapEmail}
                        disabled={!doctorEmail.trim() || emailSending}
                      >
                        {emailSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                    <p style={{ fontSize: 14, color: "#506D65", margin: "8px 0 0" }}>
                      The SOAP note will be emailed to the physician for review.
                    </p>
                  </div>
                )}
              </div>

              <button
                style={{
                  ...styles.backBtn,
                  marginTop: 20,
                  fontSize: 13,
                  color: "#1A6B5B",
                textDecoration: "none",
                }}
                onClick={() => setStep("chat")}
              >
                ← Back to Conversation
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F5FBF9" }}>
      {/* Header */}
      <div style={styles.chatHeader}>
        <img src={DR_AVATAR} alt="Dr. Fleshner" style={styles.chatAvatar} />
        <div style={{ flex: 1 }}>
          <h2 style={styles.chatHeaderName}>Dr. Neil Fleshner</h2>
          <p style={styles.chatHeaderStatus}>
            {isLoading ? "Typing..." : `${CONDITION_LABELS[detectedCondition] || "Virtual Consultation"}`}
          </p>
        </div>
        <button
          style={{
            ...styles.endConsultBtn,
            background: "transparent",
            border: "1.5px solid #506D65",
            color: "#506D65",
            marginRight: 8,
          }}
          onClick={() => setDashboardOpen(!dashboardOpen)}
        >
          {dashboardOpen ? "Hide" : "Show"} Dashboard
        </button>
        {messages.length >= 2 && (
          <button style={styles.endConsultBtn} onClick={endConsultation} disabled={isLoading}>
            End & Generate SOAP
          </button>
        )}
      </div>

      {/* Main area: Chat + Dashboard side by side */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={styles.chatMessages}>
            {displayMessages.length === 0 && !isLoading && (
              <div style={styles.chatWelcomeMsg}>
                <p style={{ margin: 0, color: "#506D65", fontSize: 17 }}>Starting your consultation...</p>
              </div>
            )}
            {displayMessages.map((msg, i) => (
              <div key={i} style={{ ...styles.messageBubbleRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && <img src={DR_AVATAR} alt="" style={styles.msgAvatar} />}
                <div style={msg.role === "user" ? styles.userBubble : styles.assistantBubble}>
                  <div style={styles.bubbleText} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ ...styles.messageBubbleRow, justifyContent: "flex-start" }}>
                <img src={DR_AVATAR} alt="" style={styles.msgAvatar} />
                <div style={styles.assistantBubble}>
                  <div style={styles.typingDots}>
                    <span style={{ ...styles.dot, animationDelay: "0s" }}>●</span>
                    <span style={{ ...styles.dot, animationDelay: "0.2s" }}>●</span>
                    <span style={{ ...styles.dot, animationDelay: "0.4s" }}>●</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={styles.chatInputArea}>
            {/* Patient Progress Bar */}
            {(() => {
              const phaseMap = {
                opening: { pct: 5, label: "Getting started" },
                intake: { pct: 20, label: "Background questions" },
                questionnaire: { pct: 45, label: "Symptom assessment" },
                follow_up: { pct: 70, label: "Almost there" },
                safety_gate: { pct: 85, label: "Final checks" },
                outcome_delivery: { pct: 95, label: "Wrapping up" },
                closed: { pct: 100, label: "Consultation complete" },
              };
              const phase = clinicalState?.phase;
              const info = phaseMap[phase] || null;
              const pct = info?.pct || (messages.length > 0 ? Math.min(messages.length * 3, 15) : 0);
              const label = info?.label || (messages.length > 0 ? "Getting started" : "");

              return pct > 0 ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#506D65", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 12, color: "#506D65" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "#D8F0EA", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct >= 100 ? "#1A6B5B" : "linear-gradient(90deg, #1A6B5B, #2A8A72)",
                      borderRadius: 2,
                      transition: "width 0.8s ease",
                    }} />
                  </div>
                </div>
              ) : null;
            })()}
            <div style={styles.inputRow}>
              <textarea
                style={styles.chatInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                rows={1}
              />
              <button
                style={{ ...styles.sendBtn, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        {/* ═══ CLINICAL DECISION DASHBOARD ═══ */}
        {dashboardOpen && (
          <div style={{
            width: 340,
            background: "#FFFFFF",
            borderLeft: "1px solid #D8F0EA",
            overflowY: "auto",
            padding: "20px 16px",
            flexShrink: 0,
            fontFamily: "-apple-system, 'Segoe UI', sans-serif",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Clinical Dashboard
              </h3>
              <span style={{
                fontSize: 10, fontWeight: 600, color: "#FFFFFF", background: "#1A6B5B",
                padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5,
              }}>LIVE</span>
            </div>

            {/* Phase Indicator */}
            <DashboardCard title="Consultation Phase">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: clinicalState?.phase === "closed" ? "#506D65" : "#1A6B5B",
                  animation: clinicalState?.phase !== "closed" ? "blink 1.5s infinite" : "none",
                }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>
                  {String(clinicalState?.phaseLabel || "Initializing...")}
                </span>
              </div>
              {clinicalState?.questionsAsked > 0 && (
                <p style={{ fontSize: 13, color: "#506D65", margin: "6px 0 0" }}>
                  {clinicalState.questionsAsked} questions asked
                  {clinicalState.questionsRemaining ? ` · ~${clinicalState.questionsRemaining} remaining` : ""}
                </p>
              )}
            </DashboardCard>

            {/* Severity Score (IPSS/SHIM) */}
            {clinicalState?.scores && typeof clinicalState.scores === "object" && Object.values(clinicalState.scores).some(v => v !== null) && (
              <DashboardCard title={detectedCondition === "ed" ? "SHIM Score" : detectedCondition === "bph" ? "IPSS Score" : "Assessment"}>
                {clinicalState.scores.total !== null && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
                      {clinicalState.scores.total}
                    </span>
                    <span style={{ fontSize: 13, color: "#506D65" }}>
                      / {detectedCondition === "ed" ? "25" : "35"}
                    </span>
                    {clinicalState.severityLabel && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                        background: clinicalState.severity === "severe" ? "#FEE2E2" : clinicalState.severity === "moderate" ? "#FEF3C7" : "#D1FAE5",
                        color: clinicalState.severity === "severe" ? "#991B1B" : clinicalState.severity === "moderate" ? "#92400E" : "#065F46",
                      }}>
                        {String(clinicalState.severityLabel || "")}
                      </span>
                    )}
                  </div>
                )}
                {/* Individual Q scores */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(clinicalState.scores).filter(([k]) => k !== "total").map(([key, val]) => (
                    <div key={key} style={{
                      width: 36, height: 36, borderRadius: 6, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      background: val !== null ? "#1A6B5B" : "#F5FBF9",
                      border: val !== null ? "none" : "1px solid #D8F0EA",
                    }}>
                      <span style={{ fontSize: 8, color: val !== null ? "rgba(255,255,255,0.6)" : "#506D65", textTransform: "uppercase" }}>
                        {key}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: val !== null ? "#FFFFFF" : "#D8F0EA" }}>
                        {val !== null ? String(val) : "–"}
                      </span>
                    </div>
                  ))}
                </div>
              </DashboardCard>
            )}

            {/* Phenotype / Etiology Signals */}
            {clinicalState?.phenotypeSignals && typeof clinicalState.phenotypeSignals === "object" && Object.values(clinicalState.phenotypeSignals).some(a => Array.isArray(a) && a.length > 0) && (
              <DashboardCard title="Clinical Signals">
                {Object.entries(clinicalState.phenotypeSignals).map(([type, signals]) => (
                  signals?.length > 0 && (
                    <div key={type} style={{ marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                        color: type === "obstructive" || type === "organic" ? "#1A6B5B" : type === "storage" || type === "psychogenic" ? "#3D5D80" : "#92400E",
                      }}>{type}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {signals.map((s, i) => (
                          <span key={i} style={{
                            fontSize: 12, padding: "3px 8px", borderRadius: 4,
                            background: "#F5FBF9", border: "1px solid #D8F0EA", color: "#374151",
                          }}>{typeof s === "string" ? s : JSON.stringify(s)}</span>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {clinicalState.phenotype && (
                  <div style={{
                    marginTop: 8, padding: "8px 10px", borderRadius: 6,
                    background: "rgba(26, 107, 91, 0.06)", border: "1px solid #D8F0EA",
                  }}>
                    <span style={{ fontSize: 11, color: "#506D65", textTransform: "uppercase", letterSpacing: 0.5 }}>Pattern: </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>{String(clinicalState.phenotype || "")}</span>
                  </div>
                )}
              </DashboardCard>
            )}

            {/* Risk Factors */}
            {clinicalState?.riskFactors?.length > 0 && (
              <DashboardCard title="Risk Factors">
                {clinicalState.riskFactors.map((rf, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: "#D97706", fontSize: 12 }}>⚠</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{typeof rf === "string" ? rf : JSON.stringify(rf)}</span>
                  </div>
                ))}
              </DashboardCard>
            )}

            {/* Safety Flags */}
            {clinicalState?.safetyFlags?.length > 0 && (
              <DashboardCard title="Safety Flags">
                {clinicalState.safetyFlags.map((sf, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: "#DC2626", fontSize: 12 }}>●</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{typeof sf === "string" ? sf : JSON.stringify(sf)}</span>
                  </div>
                ))}
              </DashboardCard>
            )}

            {/* Eligibility Checklist */}
            {clinicalState?.eligibility && (
              <DashboardCard title="Eligibility Checklist">
                {Object.entries(clinicalState.eligibility).map(([key, val]) => {
                  const labels = {
                    ageOk: "Age within range",
                    labsComplete: "Labs complete",
                    noContraindications: "No contraindications",
                    severityThresholdMet: "Severity threshold",
                    phenotypeEligible: "Phenotype eligible",
                    safetyGatePassed: "Safety gate",
                  };
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 14,
                        color: val === true ? "#1A6B5B" : val === false ? "#DC2626" : "#D8F0EA",
                      }}>
                        {val === true ? "✓" : val === false ? "✗" : "○"}
                      </span>
                      <span style={{ fontSize: 13, color: val === null ? "#506D65" : "#374151" }}>
                        {String(labels[key] || key)}
                      </span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}

            {/* Preliminary Outcome */}
            {clinicalState?.preliminaryOutcome && (
              <DashboardCard title="Preliminary Outcome">
                <div style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: clinicalState.preliminaryOutcome.startsWith("A") ? "#D1FAE5"
                    : clinicalState.preliminaryOutcome.startsWith("B") ? "#DBEAFE"
                    : clinicalState.preliminaryOutcome.startsWith("C") ? "#FEF3C7"
                    : "#F3F4F6",
                  border: "1px solid transparent",
                }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>
                    {String(clinicalState.preliminaryOutcome || "")}
                  </span>
                  {clinicalState.preliminaryOutcomeReason && (
                    <p style={{ fontSize: 12, color: "#506D65", margin: "4px 0 0", lineHeight: 1.5 }}>
                      {String(clinicalState.preliminaryOutcomeReason || "")}
                    </p>
                  )}
                </div>
              </DashboardCard>
            )}

            {/* Key Findings */}
            {clinicalState?.keyFindings?.length > 0 && (
              <DashboardCard title="Key Findings">
                {clinicalState.keyFindings.map((kf, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", lineHeight: 1.5 }}>
                    · {typeof kf === "string" ? kf : JSON.stringify(kf)}
                  </p>
                ))}
              </DashboardCard>
            )}

            {!clinicalState && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#506D65" }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>📊</div>
                <p style={{ fontSize: 13, margin: 0 }}>Dashboard will populate as the consultation progresses</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── VALIDATION ITEM COMPONENT ──
function ValidationItem({ label, value }) {
  const isPresent = value && value !== "Not available" && value !== "null" && value !== "Not done";
  return (
    <div style={styles.validationItem}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: isPresent ? "#1A6B5B" : "#3D5D80", fontSize: 14 }}>
          {isPresent ? "●" : "○"}
        </span>
        <span style={styles.valLabel}>{label}</span>
      </div>
      <span style={styles.valValue}>{value || "—"}</span>
    </div>
  );
}

// ── DASHBOARD CARD COMPONENT ──
function DashboardCard({ title, children }) {
  return (
    <div style={{
      marginBottom: 14,
      padding: "14px 12px",
      background: "#F5FBF9",
      borderRadius: 10,
      border: "1px solid #D8F0EA",
    }}>
      <h4 style={{
        fontSize: 11, fontWeight: 700, color: "#506D65",
        textTransform: "uppercase", letterSpacing: 0.8,
        margin: "0 0 10px",
      }}>{title}</h4>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════
const styles = {
  pageContainer: {
    minHeight: "100vh",
    background: "#F5FBF9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },

  // Welcome
  welcomeCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "48px 40px",
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    border: "1px solid #D8F0EA",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  welcomeAvatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #1A6B5B",
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
    color: "#1F2937",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    letterSpacing: -0.5,
  },
  accentText: { color: "#3D5D80" },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#506D65",
    margin: "2px 0 0",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    fontWeight: 500,
  },
  welcomeDesc: {
    fontSize: 17,
    lineHeight: 1.7,
    color: "#4B5563",
    marginBottom: 28,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  formGroup: { marginBottom: 18 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  input: {
    width: "100%",
    padding: "16px 18px",
    border: "1.5px solid #D8F0EA",
    borderRadius: 12,
    fontSize: 17,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    background: "#FFFFFF",
    color: "#1F2937",
  },
  primaryBtn: {
    width: "100%",
    padding: "18px 0",
    background: "#1A6B5B",
    color: "#F5FBF9",
    border: "none",
    borderRadius: 12,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    transition: "all 0.2s",
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: 13,
    color: "#547C72",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 1.5,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },

  // Upload
  uploadCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "36px 40px",
    maxWidth: 580,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    border: "1px solid #D8F0EA",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#506D65",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
    marginBottom: 16,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  uploadHeader: { marginBottom: 24 },
  uploadTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 8px",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    letterSpacing: -0.3,
  },
  uploadSubtitle: {
    fontSize: 16,
    color: "#4B5563",
    margin: 0,
    lineHeight: 1.6,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  dropZone: {
    border: "2px dashed #D8F0EA",
    borderRadius: 16,
    padding: "36px 20px",
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#F5FBF9",
  },

  // Validation
  validationPanel: {
    marginTop: 24,
    background: "#F5FBF9",
    borderRadius: 14,
    padding: "22px 18px",
    border: "1px solid #D8F0EA",
  },
  validationTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 14px",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  validationGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px 16px",
  },
  validationItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "6px 0",
  },
  valLabel: {
    fontSize: 13,
    color: "#506D65",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  valValue: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: 500,
    marginLeft: 18,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  referralBox: {
    marginTop: 14,
    padding: "14px 16px",
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #D8F0EA",
  },
  medsBox: {
    marginTop: 10,
    padding: "14px 16px",
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #D8F0EA",
  },
  referralLabel: {
    fontSize: 13,
    color: "#506D65",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  referralText: {
    fontSize: 16,
    color: "#374151",
    margin: "6px 0 0",
    lineHeight: 1.6,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },

  // Waiting Room
  waitingCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "56px 40px",
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    textAlign: "center",
    border: "1px solid #D8F0EA",
  },
  waitingAvatarWrap: {
    position: "relative",
    display: "inline-block",
    marginBottom: 28,
  },
  waitingAvatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #1A6B5B",
    position: "relative",
    zIndex: 1,
  },
  waitingPulse: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: "50%",
    border: "2px solid rgba(26, 107, 91, 0.15)",
    zIndex: 0,
  },
  waitingTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 8px",
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  waitingSubtitle: {
    fontSize: 16,
    color: "#4B5563",
    margin: "0 0 36px",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  waitingSteps: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    textAlign: "left",
    marginBottom: 32,
  },
  waitingStepRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  waitingStepIcon: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    flexShrink: 0,
    transition: "all 0.4s ease",
  },
  waitingStepLabel: {
    fontSize: 17,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    transition: "all 0.4s ease",
  },
  waitingProgressTrack: {
    height: 3,
    background: "#D8F0EA",
    borderRadius: 2,
    overflow: "hidden",
  },
  waitingProgressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #1A6B5B, #2A8A72)",
    borderRadius: 2,
  },

  // Chat
  chatPage: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#F5FBF9",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    background: "#FFFFFF",
    borderBottom: "1px solid #D8F0EA",
    flexShrink: 0,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid #1A6B5B",
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1A6B5B",
    margin: 0,
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  chatHeaderStatus: {
    fontSize: 14,
    color: "#506D65",
    margin: 0,
  },
  endConsultBtn: {
    padding: "10px 16px",
    background: "rgba(91, 127, 165, 0.15)",
    border: "1.5px solid #3D5D80",
    borderRadius: 8,
    color: "#3D5D80",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
    flexShrink: 0,
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 16px",
  },
  chatWelcomeMsg: {
    textAlign: "center",
    padding: "40px 20px",
  },
  messageBubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 14,
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    border: "1.5px solid #1A6B5B",
  },
  userBubble: {
    background: "#1A6B5B",
    color: "#F5FBF9",
    padding: "12px 18px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "75%",
  },
  assistantBubble: {
    background: "#FFFFFF",
    color: "#1F2937",
    padding: "12px 18px",
    borderRadius: "18px 18px 18px 4px",
    maxWidth: "75%",
    border: "1px solid #D8F0EA",
  },
  bubbleText: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.6,
  },
  typingDots: {
    display: "flex",
    gap: 4,
    padding: "4px 0",
  },
  dot: {
    fontSize: 10,
    color: "#506D65",
    animation: "blink 1.2s infinite",
  },

  // Input area
  chatInputArea: {
    padding: "12px 16px 24px",
    background: "#FFFFFF",
    borderTop: "1px solid #D8F0EA",
    flexShrink: 0,
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    padding: "14px 18px",
    border: "1.5px solid #D8F0EA",
    borderRadius: 22,
    fontSize: 17,
    outline: "none",
    resize: "none",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    lineHeight: 1.4,
    maxHeight: 120,
    background: "#F5FBF9",
    color: "#1F2937",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "none",
    background: "#1A6B5B",
    color: "#F5FBF9",
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.2s",
  },

  // SOAP Note Screen
  soapCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "36px 40px",
    maxWidth: 660,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    maxHeight: "90vh",
    overflowY: "auto",
    border: "1px solid #D8F0EA",
  },
  soapHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
    paddingBottom: 24,
    borderBottom: "1px solid #D8F0EA",
  },
  soapTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: "#1F2937",
    margin: 0,
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  soapSubtitle: {
    fontSize: 15,
    color: "#506D65",
    margin: "2px 0 0",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  soapLoadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 0",
  },
  soapSpinner: {
    width: 40,
    height: 40,
    border: "3px solid #D8F0EA",
    borderTopColor: "#1A6B5B",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  soapNoteBox: {
    background: "#F5FBF9",
    border: "1px solid #D8F0EA",
    borderRadius: 12,
    padding: "22px 20px",
    maxHeight: 400,
    overflowY: "auto",
  },
  soapNoteText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#374151",
    fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
  },
  soapEmailSection: {
    marginTop: 28,
    padding: "24px 0 0",
    borderTop: "1px solid #D8F0EA",
  },
  soapEmailTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 4px",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  soapSentBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 18px",
    background: "rgba(26, 107, 91, 0.06)",
    border: "1px solid #1A6B5B",
    borderRadius: 12,
    color: "#1F2937",
    fontWeight: 600,
    fontSize: 16,
    marginTop: 10,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
}

// Inject keyframes and Google Font
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @keyframes blink {
      0%, 20% { opacity: 0.2; }
      50% { opacity: 1; }
      80%, 100% { opacity: 0.2; }
    }
    @keyframes waitPulse {
      0%, 100% { transform: scale(1); opacity: 0.15; }
      50% { transform: scale(1.18); opacity: 0.4; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    input:focus, textarea:focus {
      border-color: #1A6B5B !important;
    }
    button:hover {
      opacity: 0.9;
    }
    ::placeholder {
      color: #9DD4C4;
    }
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #D8F0EA;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(styleEl);
}
