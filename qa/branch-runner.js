/**
 * Branch-coverage runner.
 *
 * Runs smoke-test against existing scenarios with playbook overrides that
 * force specific non-happy-path chip choices, so we exercise branches the
 * persona-driven simulator would otherwise miss. After every run, the
 * chip-continuity audit is invoked against the resulting transcript.
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3002 node qa/branch-runner.js
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3001";
const FINDINGS_DIR = path.join(__dirname, "..", "qa-findings");

// Each entry: { name, scenarioId, playbook[] }
// playbook entries: { triggerRegex, chipText } — fired once each, in order.
const RUNS = [
  {
    name: "bph-safety-yes-pain",
    scenarioId: "bph-1",
    playbook: [
      { triggerRegex: "burning when you pee.*blood in your pee.*fevers", chipText: "Yes — one or more of these" },
      { triggerRegex: "which one you('|’)ve been experiencing", chipText: "Bad pain in my back or side" },
    ],
  },
  {
    name: "ed-safety-yes-priapism",
    scenarioId: "ed-1",
    playbook: [
      { triggerRegex: "chest pain during or after sex.*erection that wouldn", chipText: "Yes — one or more of these" },
      { triggerRegex: "which one you('|’)ve been experiencing", chipText: "Erection that wouldn't go down" },
    ],
  },
  {
    name: "mh-safety-yes-pain",
    scenarioId: "mh-1",
    playbook: [
      { triggerRegex: "blood in your pee that you could actually see.*fever or chills", chipText: "Yes — one or more of these" },
      { triggerRegex: "which one you('|’)ve been experiencing", chipText: "Bad pain in my side or back" },
    ],
  },
  {
    name: "mh-gross-recent-with-clots",
    scenarioId: "mh-1",
    playbook: [
      { triggerRegex: "noticed blood in your pee that you could actually see.*pink, red, or brown", chipText: "Yes" },
      { triggerRegex: "When was the last time that happened", chipText: "In the last few weeks" },
      { triggerRegex: "still happening.*clots or having trouble peeing", chipText: "Yes, with clots or trouble peeing" },
    ],
  },
  {
    name: "bph-question-first",
    scenarioId: "bph-1",
    playbook: [
      { triggerRegex: "Ready to get started", chipText: "I have a question first" },
    ],
  },
];

function runOne(run) {
  return new Promise((resolve) => {
    const suffix = `-branch-${run.name}`;
    console.log(`\n${"=".repeat(70)}\n>>> RUN ${run.name}  (scenario: ${run.scenarioId})\n${"=".repeat(70)}`);
    const t0 = Date.now();
    const child = spawn("node", ["qa/smoke-test.js", run.scenarioId], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        SMOKE_BASE_URL: BASE_URL,
        SMOKE_OUT_SUFFIX: suffix,
        PLAYBOOK_OVERRIDES: JSON.stringify(run.playbook),
      },
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      const dur = Math.round((Date.now() - t0) / 1000);
      console.log(`\n>>> ${run.name} exited ${code} after ${dur}s`);
      resolve({ run: run.name, code, dur, outFile: `smoke-test-${run.scenarioId}${suffix}.json` });
    });
  });
}

(async () => {
  const results = [];
  for (const run of RUNS) {
    const r = await runOne(run);
    results.push(r);
  }

  // Run the chip-continuity audit across every branch-* transcript we just produced.
  console.log("\n" + "=".repeat(70));
  console.log("CHIP-CONTINUITY AUDIT");
  console.log("=".repeat(70));
  const branchFiles = results.map((r) => path.join(FINDINGS_DIR, r.outFile)).filter((p) => fs.existsSync(p));
  if (!branchFiles.length) {
    console.log("No branch transcripts produced — audit skipped.");
    return;
  }
  const auditChild = spawn("node", ["qa/chip-continuity-audit.js", ...branchFiles], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });
  await new Promise((resolve) => auditChild.on("exit", resolve));
})();
