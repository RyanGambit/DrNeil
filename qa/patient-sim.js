/**
 * Patient simulator — answers Dr. Fleshner's questions in character.
 *
 * Given scenario data (the same shape as SCENARIO_DB entries in app/page.jsx)
 * and the conversation so far, returns a realistic patient response. If chips
 * are present in the UI for the latest assistant message, the simulator picks
 * the chip that best matches the persona; otherwise it types a free-text reply.
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Strip qid markers from assistant text before showing to simulator —
// the simulator should react to what the patient sees, not the raw protocol.
function cleanText(t) {
  return t.replace(/<!--\s*qid:[^>]+-->/gi, "").trim();
}

function buildPersonaSystemPrompt(scenario) {
  const d = scenario.data;
  const lines = [
    "You are roleplaying as a real patient in a virtual consultation with a urologist (Dr. Fleshner).",
    "",
    "PATIENT CHARACTER:",
    `Name: ${d.name}`,
    `Age: ${d.age}`,
    `Sex: ${d.sex}`,
    d.referralReason ? `Why you were referred: ${d.referralReason}` : null,
  ].filter(Boolean);

  // Condition-specific facts the patient knows.
  if (scenario.condition === "ed") {
    if (d.priorEdTreatment) lines.push(`Prior ED treatment: ${d.priorEdTreatment}`);
    if (d.edDuration) lines.push(`How long: ${d.edDuration}`);
    if (d.edSeverity) lines.push(`Severity: ${d.edSeverity}`);
  }
  if (scenario.condition === "bph") {
    lines.push("LUTS symptoms include: frequency, nocturia (multiple times per night), hesitancy, weak stream, post-void dribbling.");
  }
  if (scenario.condition === "mh") {
    if (d.rbcHpf) lines.push(`Found incidentally on a urine test (${d.rbcHpf})`);
    lines.push("You have NO urinary symptoms — no pain, no blood you can see, no burning.");
  }

  if (d.medicalHistory?.length) lines.push(`Medical history: ${d.medicalHistory.join(", ")}`);
  if (d.surgicalHistory?.length) lines.push(`Surgical history: ${d.surgicalHistory.join(", ")}`);
  if (d.medications?.length) lines.push(`Medications: ${d.medications.join(", ")}`);
  if (d.allergies) lines.push(`Allergies: ${d.allergies}`);

  lines.push("");
  lines.push("RULES FOR YOUR REPLIES:");
  lines.push("- Talk like a real patient — short, natural, sometimes hesitant. 1–3 sentences.");
  lines.push("- Use everyday language. Don't lecture.");
  lines.push("- Only share what was asked. Don't volunteer your full history at once.");
  lines.push("- If you don't know something, say so honestly (e.g. 'I'm not sure', 'I'd have to check').");
  lines.push("- Stay in character. Never break the fourth wall. Never mention you're an AI or simulator.");
  lines.push("- Stress, embarrassment, or worry are realistic and welcome where they fit.");
  lines.push("");
  lines.push("If chips/multiple-choice options are provided, you MUST pick exactly one chip whose label best fits an honest answer for your character. Reply with ONLY the chip text, no extra commentary.");
  lines.push("If no chips are provided, reply in free text.");

  return lines.join("\n");
}

/**
 * Generate the patient's next response.
 *
 * @param {Object} scenario   - SCENARIO_DB-shaped object
 * @param {Array}  history    - [{ role, text }] conversation so far (markers ok, will be stripped)
 * @param {Array|null} chips  - chip labels offered by the UI for the latest assistant message, or null
 * @returns {Promise<{text: string, chipPicked: string|null}>}
 */
async function generatePatientReply(scenario, history, chips) {
  const messages = history.map((m) => ({
    role: m.role === "assistant" ? "user" : "assistant",  // role-flip: from patient's POV, doctor=user
    content: cleanText(m.text || ""),
  }));

  // The latest doctor message must be last; if history ends on patient turn, that's wrong.
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    throw new Error("History must end with an assistant (doctor) message for sim to reply.");
  }

  let chipsBlock = "";
  if (chips?.length) {
    chipsBlock = "\n\nThe doctor offered these reply options. Pick exactly ONE — output only that option's text, nothing else:\n" +
      chips.map((c, i) => `${i + 1}. ${c}`).join("\n");
    messages[messages.length - 1].content += chipsBlock;
  }

  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    system: buildPersonaSystemPrompt(scenario),
    messages,
  });

  let text = resp.content[0]?.text?.trim() || "";

  // If chips were offered, normalize the output to match a real chip exactly.
  let chipPicked = null;
  if (chips?.length) {
    // Try exact match first, then fuzzy contains
    chipPicked = chips.find((c) => c.toLowerCase() === text.toLowerCase());
    if (!chipPicked) {
      chipPicked = chips.find((c) => text.toLowerCase().includes(c.toLowerCase()));
    }
    if (!chipPicked) {
      chipPicked = chips.find((c) => c.toLowerCase().includes(text.toLowerCase().slice(0, 30)));
    }
    if (!chipPicked) {
      // Last resort: pick the first chip and log
      console.warn(`[sim] Could not match chip — falling back. Sim said: "${text}". Chips: ${JSON.stringify(chips)}`);
      chipPicked = chips[0];
    }
    text = chipPicked;
  }

  return { text, chipPicked, usage: resp.usage };
}

module.exports = { generatePatientReply, cleanText };
