/**
 * SERVER-SIDE MARKER INJECTOR
 *
 * The client (app/page.jsx) expects every clinical-question assistant message
 * to carry a hidden `<!-- qid:X -->` marker. The model is instructed to emit
 * these but drops them ~75% of the time on long sequential question runs.
 *
 * This module backstops the model: when the API returns assistant text without
 * a marker, we match the text against the registry (mirroring the client-side
 * `detectQidFromText` logic) and inject the marker before returning to the UI.
 *
 * Idempotent: if a marker is already present, we leave the text untouched.
 * Conservative: if no needle matches, we leave the text untouched (graceful
 * degrade to the existing client-side fallback).
 */
import edRegistry from "../prompts/ed-question-registry.js";
import bphRegistry from "../prompts/bph-question-registry.js";
import mhRegistry from "../prompts/mh-question-registry.js";

const REGISTRIES = { ed: edRegistry, bph: bphRegistry, mh: mhRegistry };
const QID_MARKER_RE = /<!--\s*qid:[a-z0-9-]+\s*-->/i;

// Build candidate needles from a registry — same shape as the client code.
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
  // Longer needles are more specific — try them first.
  candidates.sort((a, b) => b.needle.length - a.needle.length);
  return candidates;
}

// Memoized per-condition candidate list — registries are static at module load.
const CANDIDATES = {
  ed: buildCandidates(edRegistry),
  bph: buildCandidates(bphRegistry),
  mh: buildCandidates(mhRegistry),
};

function detectQid(text, condition) {
  const candidates = CANDIDATES[condition];
  if (!candidates) return null;
  const lower = text.toLowerCase();
  for (const c of candidates) {
    if (lower.includes(c.needle)) return c.id;
  }
  return null;
}

/**
 * Inject a qid marker into an assistant text block if missing.
 * Returns { text, injected: boolean, qid: string|null }.
 */
export function injectMarker(text, condition) {
  if (!text || typeof text !== "string") return { text, injected: false, qid: null };
  if (QID_MARKER_RE.test(text)) return { text, injected: false, qid: null };
  if (!REGISTRIES[condition]) return { text, injected: false, qid: null };

  const qid = detectQid(text, condition);
  if (!qid) return { text, injected: false, qid: null };

  const trimmed = text.replace(/\s+$/, "");
  return {
    text: `${trimmed}\n\n<!-- qid:${qid} -->`,
    injected: true,
    qid,
  };
}

/**
 * Process an Anthropic /v1/messages content array (array of { type, text } blocks).
 * Mutates a shallow copy of each text block to add the marker when missing.
 * Returns { content, stats: { textBlocks, alreadyMarked, injected, unmatched } }.
 */
export function injectMarkersIntoContent(content, condition) {
  if (!Array.isArray(content)) return { content, stats: null };
  const stats = { textBlocks: 0, alreadyMarked: 0, injected: 0, unmatched: 0 };
  const out = content.map((block) => {
    if (!block || block.type !== "text" || typeof block.text !== "string") return block;
    stats.textBlocks++;
    if (QID_MARKER_RE.test(block.text)) {
      stats.alreadyMarked++;
      return block;
    }
    const result = injectMarker(block.text, condition);
    if (result.injected) {
      stats.injected++;
      return { ...block, text: result.text };
    }
    stats.unmatched++;
    return block;
  });
  return { content: out, stats };
}
