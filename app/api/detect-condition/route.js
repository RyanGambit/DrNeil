// ═══════════════════════════════════════════════════════════════════════
// CONDITION DETECTION — Server-side only (keeps classification logic hidden)
// ═══════════════════════════════════════════════════════════════════════

function detectCondition(referralReason, medicalHistory) {
  const text = ((referralReason || "") + " " + (medicalHistory || "")).toLowerCase();

  const bphKeywords = [
    "bph", "luts", "lower urinary tract", "urinary frequency",
    "nocturia", "hesitancy", "weak stream", "dribbling",
    "prostatic hyperplasia", "voiding", "urinary symptoms",
    "incomplete emptying", "straining", "intermittency",
    "post-void residual", "benign prostate",
  ];

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

  const mhKeywords = [
    "hematuria", "microhematuria", "blood in urine", "rbc in urine",
    "red blood cells", "microscopic blood", "microscopic hematuria",
    "urine blood", "dipstick positive", "blood in the urine",
    "rbc", "hemoglobin in urine",
  ];

  const bphScore = bphKeywords.filter((k) => text.includes(k)).length;
  const edScore = edKeywords.filter((k) => text.includes(k)).length;
  const mhScore = mhKeywords.filter((k) => text.includes(k)).length;

  const rawText = ((referralReason || "") + " " + (medicalHistory || ""));
  if (/\bED\b/.test(rawText)) {
    return edScore + 2 >= bphScore && edScore + 2 >= mhScore ? "ed" :
           bphScore > mhScore ? "bph" : mhScore > 0 ? "mh" : "ed";
  }

  if (bphScore >= edScore && bphScore >= mhScore && bphScore > 0) return "bph";
  if (edScore >= bphScore && edScore >= mhScore && edScore > 0) return "ed";
  if (mhScore >= bphScore && mhScore >= edScore && mhScore > 0) return "mh";

  return "unknown";
}

export async function POST(request) {
  try {
    const { referralReason, medicalHistory } = await request.json();
    const condition = detectCondition(referralReason, medicalHistory);
    return Response.json({ condition });
  } catch (error) {
    console.error("Condition detection error:", error);
    return Response.json({ condition: "unknown" });
  }
}
