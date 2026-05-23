/**
 * Registry/Prompt Coverage Audit
 *
 * Catches the class of bug where the AI is told to ask a follow-up
 * question but there's no registry entry to deliver chips for it —
 * the patient ends up staring at a chat message with no UI to respond
 * to (or, worse, the wrong chips from a stale registry match).
 *
 * What this audits, per condition (BPH / ED / MH):
 *   1. Every `<!-- qid:X -->` referenced in the prompt has a registry
 *      entry with id X. Broken refs print as ERRORS.
 *   2. Every chip-bearing registry entry is referenced somewhere in the
 *      prompt. Unreferenced entries print as ORPHANS (the AI will
 *      never use them).
 *   3. Every chip's routing destination either (a) is a known terminal
 *      action, or (b) implies a follow-up that the prompt covers via
 *      a qid marker. Suspected gaps print as GAPS.
 *
 * Exit code is non-zero if any ERROR-level findings exist.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import bphRegistry from "../prompts/bph-question-registry.js";
import edRegistry from "../prompts/ed-question-registry.js";
import mhRegistry from "../prompts/mh-question-registry.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const CONDITIONS = [
  { name: "bph", registry: bphRegistry, promptFile: "prompts/bph.js" },
  { name: "ed",  registry: edRegistry,  promptFile: "prompts/ed.js"  },
  { name: "mh",  registry: mhRegistry,  promptFile: "prompts/mh.js"  },
];

// Routing destinations that are legitimately terminal — they don't require
// the AI to ask another chip-bearing question. Adding to this list is a
// deliberate "this is a dead-end, no follow-up question needed" decision.
const TERMINAL_DESTINATIONS = new Set([
  "continue",
  "continue_no_risk",
  "continue_shim",
  "continue_to_message_2",
  "continue_to_message_3",
  "continue_with_note",
  "continue_with_timing_note",
  "all_gates_passed",
  "deliver_outcome_a",
  "absolute_stop_outcome_c",
  "outcome_c_cataract",
  "outcome_c_cv_risk",
  "outcome_c_inperson",
  "outcome_c_peyronies",
  "outcome_c_priapism",
  "outcome_c_syncope",
  "prescribe_sildenafil",
  "prescribe_tadalafil",
  "er_referral",
  "walkin_clinic",
  "urgent_escalation",
  "nocturia_5_plus_outcome_c",
  "first_line_eligible",
  // Signal-only destinations: AI records this and moves on, no question asked.
  "note_storage_signal",
  "storage_severity_flag",
  "adequate_trial_signal",
  "inadequate_trial_signal",
  "organic_signal",
  "psychogenic_signal",
  "psychogenic_or_medication_signal",
  "mixed_signal",
  "less_likely_psychogenic",
  "likely_reactive_to_ed",
  "borderline",
  "record_uncertain",
  "risk_factor_present",
  "first_occurrence",
  "extra_reassurance",
  "flag_menstrual_contamination",
  "flag_pregnancy_imaging_limit",
  "flag_for_partner_question_later",
  "flag_medication_for_pcp",
  "note_possible_stones",
  "note_for_outcome_c_consideration",
  "path_3_trigger",
  "suspect_testosterone_deficiency",
  "possible_testosterone",
  "recurrent_not_evaluated",
  "address_cancer_fear",
  "proceed_with_ophthalmologist_note",
  "proceed_to_safety_gate",
  "skip_shim_q2_q5_ask_why",
  // Text-response destinations: patient types free text in the chat input,
  // no chips needed. The UI's "Type your answer below" hint covers this.
  "follow_up_text",
  "follow_up_flagged_fields",
  "follow_up_text_listen_for_nitrates",
  "follow_up_chemo_type",
  "answer_then_continue",
  "answer_then_reask",
  "explore_discordance",
  "ask_family_details",
  "ask_prior_workup_details",
  "ask_uti_followup",
  "ask_fatigue_mood",
]);

// Placeholders in prompt docs that aren't real qid references.
const PLACEHOLDER_QIDS = new Set([
  "question-id-here",
  "x", // sometimes used as a generic example
]);

// Manual overrides: when a chip's routing destination is covered by a
// specific registry entry whose id name doesn't share tokens with the
// destination. Add a row here when you fix a gap with a renamed entry.
const FOLLOW_UP_COVERAGE = {
  "tiered_red_flag_routing": "opening-safety-followup",
  "tiered_emergency_routing": "opening-safety-followup",
  "nocturnal_polyuria_ask_apnea": "followup-snoring",
  "ask_currently_ongoing": "risk-q2b-gross-current",
};

// Destinations whose names make it obvious they trigger a follow-up
// question. If we see one of these, the prompt MUST cover the follow-up
// via a qid marker (or we flag it as a likely gap).
const FOLLOW_UP_PREFIXES = ["ask_", "follow_up_", "explore_"];
const FOLLOW_UP_SUFFIXES = ["_routing", "_followup", "_ask_apnea", "_ask_when", "_ask_why"];

function looksLikeFollowUp(dest) {
  return (
    FOLLOW_UP_PREFIXES.some((p) => dest.startsWith(p)) ||
    FOLLOW_UP_SUFFIXES.some((s) => dest.endsWith(s)) ||
    dest === "tiered_red_flag_routing" ||
    dest === "tiered_emergency_routing" ||
    dest === "answer_then_reask" ||
    dest === "answer_then_continue" ||
    dest === "path3_assess_urgency" ||
    dest === "assess_if_acute"
  );
}

function extractQidsFromPrompt(promptText) {
  const re = /<!--\s*qid:([a-z0-9-]+)\s*-->/gi;
  const found = new Set();
  let m;
  while ((m = re.exec(promptText)) !== null) found.add(m[1]);
  return found;
}

const findings = { errors: [], orphans: [], gaps: [] };

for (const { name, registry, promptFile } of CONDITIONS) {
  const promptPath = path.join(ROOT, promptFile);
  const promptText = fs.readFileSync(promptPath, "utf8");
  const promptQids = extractQidsFromPrompt(promptText);
  const registryIds = new Set(registry.map((e) => e.id));

  // 1. Broken refs: prompt mentions qid that doesn't exist in registry.
  for (const qid of promptQids) {
    if (PLACEHOLDER_QIDS.has(qid)) continue;
    if (!registryIds.has(qid)) {
      findings.errors.push(`[${name}] prompt references unknown qid: ${qid}`);
    }
  }

  // 2. Orphans: registry entry with chips never referenced in prompt.
  for (const e of registry) {
    if (!e.chips) continue;
    if (!promptQids.has(e.id)) {
      findings.orphans.push(`[${name}] registry entry has chips but prompt never references it: ${e.id}`);
    }
  }

  // 3. Gaps: chip routing destinations that look like follow-ups but no
  //    clearly-named follow-up entry exists in the registry.
  for (const e of registry) {
    if (!e.routing) continue;
    for (const [chip, dest] of Object.entries(e.routing)) {
      if (TERMINAL_DESTINATIONS.has(dest)) continue;
      if (!looksLikeFollowUp(dest)) continue;
      // Manual override: explicit coverage mapping wins.
      if (FOLLOW_UP_COVERAGE[dest] && registryIds.has(FOLLOW_UP_COVERAGE[dest])) continue;
      // Heuristic: a follow-up exists if any registry entry's id contains
      // a recognizable token from the destination name.
      const destTokens = dest.split("_").filter((t) => t.length >= 4 && t !== "ask" && t !== "follow" && t !== "routing");
      const hasFollowUp = [...registryIds].some((id) =>
        destTokens.some((tok) => id.includes(tok))
      );
      if (!hasFollowUp) {
        findings.gaps.push(`[${name}] ${e.id} chip "${chip}" → "${dest}" (no obvious follow-up entry in registry)`);
      }
    }
  }
}

function printSection(title, items) {
  console.log("\n" + "=".repeat(70));
  console.log(title + "  (" + items.length + ")");
  console.log("=".repeat(70));
  if (items.length === 0) {
    console.log("  none");
  } else {
    items.forEach((line) => console.log("  " + line));
  }
}

printSection("ERRORS — prompt → unknown registry qid", findings.errors);
printSection("ORPHANS — chip-bearing entries the prompt never asks", findings.orphans);
printSection("GAPS — chip routes to a follow-up with no matching entry", findings.gaps);

console.log("\n");
if (findings.errors.length) {
  console.log("FAIL — " + findings.errors.length + " ERROR-level findings.");
  process.exit(1);
} else {
  console.log("OK — no broken qid references. Review ORPHANS and GAPS manually.");
}
