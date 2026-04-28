/**
 * Sequential runner for all built-in SCENARIO_DB entries.
 * Skips any scenario whose JSON output already exists unless --force is passed.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCENARIOS = ["bph-1", "bph-2", "ed-1", "ed-2", "mh-1", "mh-2"];
const FORCE = process.argv.includes("--force");
const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3001";

function runOne(id) {
  return new Promise((resolve) => {
    const out = path.join(__dirname, "..", "qa-findings", `smoke-test-${id}.json`);
    if (!FORCE && fs.existsSync(out)) {
      // Re-run only if older than 1 hour AND --force absent.
      const ageMs = Date.now() - fs.statSync(out).mtimeMs;
      if (ageMs < 60 * 60 * 1000) {
        console.log(`\n=== ${id} === SKIP (cached, age ${Math.round(ageMs/60000)}min)`);
        return resolve({ id, skipped: true });
      }
    }
    console.log(`\n${"=".repeat(60)}\n>>> RUNNING ${id}\n${"=".repeat(60)}`);
    const t0 = Date.now();
    const child = spawn("node", ["qa/smoke-test.js", id], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, SMOKE_BASE_URL: BASE_URL },
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      const dur = Math.round((Date.now() - t0) / 1000);
      console.log(`\n>>> ${id} exited ${code} after ${dur}s`);
      resolve({ id, code, dur });
    });
  });
}

(async () => {
  const results = [];
  for (const id of SCENARIOS) {
    const r = await runOne(id);
    results.push(r);
  }
  console.log("\n" + "=".repeat(60));
  console.log("BATCH SUMMARY");
  console.log("=".repeat(60));
  const summary = [];
  for (const r of results) {
    if (r.skipped) {
      summary.push({ id: r.id, status: "skipped" });
      continue;
    }
    try {
      const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "qa-findings", `smoke-test-${r.id}.json`), "utf8"));
      summary.push({
        id: r.id,
        turns: j.turns,
        ended: j.ended,
        markerRate: j.markers ? `${Math.round(j.markers.rate*100)}%` : "n/a",
        usage: j.usage ? `${j.usage.input_tokens || 0}in/${j.usage.output_tokens || 0}out` : "n/a",
        durSec: r.dur,
      });
    } catch (e) {
      summary.push({ id: r.id, error: String(e.message || e) });
    }
  }
  console.table(summary);
  fs.writeFileSync(
    path.join(__dirname, "..", "qa-findings", "batch-summary.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), results: summary }, null, 2)
  );
  console.log("\n→ wrote qa-findings/batch-summary.json");
})();
