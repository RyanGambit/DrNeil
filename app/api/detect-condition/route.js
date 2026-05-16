// ═══════════════════════════════════════════════════════════════════════
// CONDITION DETECTION — Server-side only (keeps classification logic hidden)
// ═══════════════════════════════════════════════════════════════════════

function detectCondition(referralReason, medicalHistory) {
  const text = ((referralReason || "") + " " + (medicalHistory || "")).toLowerCase();

  // Weighted keyword lists: [keyword, weight]
  // Weight 3 = strong/specific signal, weight 1 = weak/shared/ambiguous
  const bphKeywords = [
    ["bph", 3],
    ["luts", 3],
    ["lower urinary tract", 3],
    ["urinary frequency", 2],
    ["nocturia", 1],           // shared with MH presentations
    ["hesitancy", 2],
    ["weak stream", 3],
    ["dribbling", 2],
    ["prostatic hyperplasia", 3],
    ["voiding", 1],            // shared with MH presentations
    ["urinary symptoms", 1],
    ["incomplete emptying", 2],
    ["straining", 2],
    ["intermittency", 2],
    ["post-void residual", 3],
    ["benign prostate", 3],
  ];

  const edKeywords = [
    ["erectile dysfunction", 3],
    ["erectile", 3],
    ["impotence", 3],
    ["sexual dysfunction", 2],
    ["erection", 2],
    ["erections", 2],
    ["difficulty with erection", 3],
    ["difficulty getting", 2],
    ["difficulty maintaining", 2],
    ["unable to maintain", 2],
    ["libido", 2],
    ["sexual function", 2],
    ["sexual health", 1],
    ["pde5", 3],
    ["viagra", 3],
    ["cialis", 3],
    ["sildenafil", 3],
    ["tadalafil", 3],
    ["can't get hard", 3],
    ["trouble getting hard", 3],
    ["intimacy concerns", 1],
    // "performance" removed — too ambiguous
  ];

  const mhKeywords = [
    ["hematuria", 3],
    ["microhematuria", 3],
    ["blood in urine", 3],
    ["rbc in urine", 3],
    ["red blood cells", 2],
    ["microscopic blood", 3],
    ["microscopic hematuria", 3],
    ["urine blood", 3],
    ["dipstick positive", 2],
    ["blood in the urine", 3],
    ["hemoglobin in urine", 2],
    // "rbc" removed — too short/non-specific as standalone
  ];

  // Calculate weighted scores
  let bphScore = 0;
  for (const [keyword, weight] of bphKeywords) {
    if (text.includes(keyword)) bphScore += weight;
  }

  let edScore = 0;
  for (const [keyword, weight] of edKeywords) {
    if (text.includes(keyword)) edScore += weight;
  }

  let mhScore = 0;
  for (const [keyword, weight] of mhKeywords) {
    if (text.includes(keyword)) mhScore += weight;
  }

  // If hematuria (the definitive MH signal) appears alongside BPH-shared
  // keywords like "nocturia" or "voiding", boost MH to avoid misrouting
  const hasHematuria = text.includes("hematuria") || text.includes("blood in urine") ||
    text.includes("blood in the urine") || text.includes("microscopic blood");
  const hasSharedBphKeywords = text.includes("nocturia") || text.includes("voiding");
  if (hasHematuria && hasSharedBphKeywords) {
    mhScore += 2;
  }

  // Determine winner — ties return "unknown" to avoid first-checked bias
  if (bphScore === 0 && edScore === 0 && mhScore === 0) return "unknown";

  if (bphScore > edScore && bphScore > mhScore) return "bph";
  if (edScore > bphScore && edScore > mhScore) return "ed";
  if (mhScore > bphScore && mhScore > edScore) return "mh";

  // Scores are tied — return unknown for proper triage
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
