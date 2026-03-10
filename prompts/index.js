// ═══════════════════════════════════════════════════════════════════════
// PROMPT REGISTRY
// Each prompt lives in its own file for easy editing.
// To update a prompt: edit the corresponding file and redeploy.
// ═══════════════════════════════════════════════════════════════════════

export { default as bphPrompt } from "./bph";
export { default as edPrompt } from "./ed";
export { default as mhPrompt } from "./mh";
export { default as unknownPrompt } from "./unknown";

export const PROMPT_REGISTRY = {
  bph: null,    // loaded dynamically in API route
  ed: null,
  mh: null,
  unknown: null,
};
