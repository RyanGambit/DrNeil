/**
 * Chip-Continuity Audit
 *
 * Reads a smoke-test transcript and flags AI turns where:
 *   - The AI asks a question (text contains "?")
 *   - The text has no qid marker
 *   - detectQidFromText() finds no matching registry entry
 *   - The message isn't a known terminal/closing pattern
 *
 * These are the turns where the patient would see a question with no
 * chips below it — the bug class that bit us on the safety screen.
 *
 * Usage:
 *   node qa/chip-continuity-audit.js qa-findings/smoke-test-bph-1.json
 *   node qa/chip-continuity-audit.js --all   # audits every smoke-test-*.json
 *
 * Exit code is non-zero if any chip-discontinuity findings exist.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import bphRegistry from "../prompts/bph-question-registry.js";
import edRegistry from "../prompts/ed-question-registry.js";
import mhRegistry from "../prompts/mh-question-registry.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const FINDINGS_DIR = path.join(ROOT, "qa-findings");

const REGISTRIES = { bph: bphRegistry, ed: edRegistry, mh: mhRegistry };

const QID_MARKER_RE = /<!--\s*qid:([a-z0-9-]+)\s*-->/i;

// Mirrors the candidate-build logic in app/page.jsx detectQidFromText
// and lib/marker-injector.js — keep these three in lockstep.
function buildCandidates(registry) {
  const candidates = [];
  for (const e of registry) {
    if (e.question) {
      const lines = e.question.split("\n").map((l) => l.trim()).filter(Boolean);
      const qLine = [...lines].reverse().find((l) => l.includes("?")) || lines[0] || "";
      const needle = qLine.toLowerCase();
      if (needle.length >= 15) candidates.push({ id: e.id, needle });
    }
    if (Array.isArray(e.fingerprints)) {
      for (const fp of e.fingerprints) {
        const needle = String(fp).toLowerCase();
        if (needle.length >= 10) candidates.push({ id: e.id, needle });
      }
    }
  }
  candidates.sort((a, b) => b.needle.length - a.needle.length);
  return candidates;
}

const CANDIDATES = {
  bph: buildCandidates(bphRegistry),
  ed: buildCandidates(edRegistry),
  mh: buildCandidates(mhRegistry),
};

function detectQid(text, condition) {
  const list = CANDIDATES[condition];
  if (!list) return null;
  const lower = text.toLowerCase();
  for (const c of list) if (lower.includes(c.needle)) return c.id;
  return null;
}

// Mirrors isTerminalMessage in app/page.jsx — terminal messages don't need
// chips; they end the consultation.
function isTerminalMessage(text) {
  if (!text) return false;
  return (
    /\[Schedule (Follow-Up|In-Person Visit|Testing|Tests)\]/i.test(text) ||
    /Take care[,!\s]/i.test(text) ||
    /Talk soon[,!\s]/i.test(text) ||
    /stop the pill and go to the ER/i.test(text) ||
    /(get you|let'?s get you|you should get) scheduled (for|in) (an?\s+)?in[- ]person/i.test(text) ||
    /(go to|head to) (the )?(emergency (department|room)|ER)\b/i.test(text) ||
    /(go to|visit|head to)(\s+a| the)?\s+walk[- ]in clinic/i.test(text)
  );
}

// AI messages that legitimately don't need chips even though they may end
// in a question — text-response prompts where the patient types freely.
const TEXT_RESPONSE_PATTERNS = [
  /what medications/i,
  /any allergies/i,
  /any other (medical|surgical)/i,
  /what brings you/i,
  /tell me (a bit|more)/i,
  /how long (have|has)/i,
  /what'?s? on your mind/i,
];

function isTextResponseExpected(text) {
  return TEXT_RESPONSE_PATTERNS.some((re) => re.test(text));
}

function auditTranscript(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const condition = data.scenario?.condition;
  if (!condition || !REGISTRIES[condition]) {
    return { filePath, error: `unknown or missing condition: ${condition}` };
  }
  const raw = data.rawAssistantMsgs || [];
  const findings = [];
  let withMarker = 0;
  let textMatched = 0;
  let terminal = 0;
  let textResponse = 0;
  let unmatched = 0;

  raw.forEach((text, idx) => {
    const markerMatch = QID_MARKER_RE.exec(text);
    if (markerMatch) { withMarker++; return; }

    if (isTerminalMessage(text)) { terminal++; return; }

    const matchedQid = detectQid(text, condition);
    if (matchedQid) { textMatched++; return; }

    if (!text.includes("?")) {
      // Not asking a question — probably an ack/transition. Fine.
      return;
    }

    if (isTextResponseExpected(text)) { textResponse++; return; }

    // Failure: marker-less question with no needle match and not terminal.
    unmatched++;
    findings.push({
      turn: idx,
      preview: text.replace(/\s+/g, " ").slice(0, 180),
      full: text,
    });
  });

  return {
    filePath,
    scenarioId: data.scenarioId,
    condition,
    rawTurns: raw.length,
    stats: { withMarker, textMatched, terminal, textResponse, unmatched },
    findings,
  };
}

function printReport(report) {
  if (report.error) {
    console.log(`\n[${report.filePath}] ERROR: ${report.error}`);
    return;
  }
  const { scenarioId, condition, rawTurns, stats, findings } = report;
  const ok = findings.length === 0;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${scenarioId}  (${condition})  ${rawTurns} AI turns`);
  console.log("=".repeat(70));
  console.log(
    `  marker:${stats.withMarker}  text-matched:${stats.textMatched}  ` +
    `terminal:${stats.terminal}  text-resp:${stats.textResponse}  ` +
    `unmatched:${stats.unmatched}`
  );
  if (ok) {
    console.log("  ✓ All AI questions render chips or are terminal/text-response.");
  } else {
    console.log(`  ✗ ${findings.length} chip-discontinuity findings:`);
    findings.forEach((f) => {
      console.log(`\n    Turn ${f.turn}:`);
      console.log(`      ${f.preview}${f.preview.length >= 180 ? "..." : ""}`);
    });
  }
}

function main() {
  const args = process.argv.slice(2);
  let files;
  if (args.includes("--all")) {
    files = fs
      .readdirSync(FINDINGS_DIR)
      .filter((f) => /^smoke-test-.*\.json$/.test(f))
      .map((f) => path.join(FINDINGS_DIR, f));
    if (!files.length) {
      console.log("No smoke-test-*.json files found in qa-findings/.");
      process.exit(0);
    }
  } else if (args.length) {
    files = args.map((a) => (path.isAbsolute(a) ? a : path.join(ROOT, a)));
  } else {
    console.log("Usage: node qa/chip-continuity-audit.js <transcript.json> | --all");
    process.exit(1);
  }

  const reports = files.map(auditTranscript);
  reports.forEach(printReport);

  const totalFindings = reports.reduce(
    (n, r) => n + (r.findings?.length || 0),
    0
  );
  console.log("\n" + "=".repeat(70));
  console.log(`SUMMARY  ${reports.length} transcripts  ${totalFindings} findings`);
  console.log("=".repeat(70));

  // Write aggregate report
  const outPath = path.join(FINDINGS_DIR, "chip-continuity-report.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ timestamp: new Date().toISOString(), reports }, null, 2)
  );
  console.log(`→ wrote ${path.relative(ROOT, outPath)}`);

  process.exit(totalFindings > 0 ? 1 : 0);
}

main();
