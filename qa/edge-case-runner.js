/**
 * Edge-case test runner.
 *
 * Drives smoke-test through each entry in qa/edge-cases.js, injecting the
 * disruption at the configured assistant turn and capturing the AI's
 * response. Then optionally invokes an AI judge to classify each response.
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3002 node qa/edge-case-runner.js [filter]
 *
 * `filter` is an optional comma-separated list of edge-case ids or
 * categories. Examples:
 *   node qa/edge-case-runner.js               # run everything
 *   node qa/edge-case-runner.js A,K           # run categories A and K
 *   node qa/edge-case-runner.js B1-real-doctor # run a single test
 */

require("dotenv").config({ path: ".env.local", override: true });

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const { EDGE_CASES, EDGE_CATEGORIES } = require("./edge-cases.js");

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3001";
const FINDINGS_DIR = path.join(__dirname, "..", "qa-findings");
const SHOULD_JUDGE = process.env.SKIP_JUDGE !== "1";

function selectCases(filter) {
  if (!filter) return EDGE_CASES;
  const tokens = filter.split(",").map((s) => s.trim()).filter(Boolean);
  return EDGE_CASES.filter((c) => tokens.includes(c.id) || tokens.includes(c.category));
}

function runOne(edge) {
  return new Promise((resolve) => {
    const suffix = `-edge-${edge.id}`;
    console.log(`\n${"=".repeat(70)}`);
    console.log(`[${edge.category}] ${edge.id}`);
    console.log(`  scenario: ${edge.scenarioId}  injectAt: turn ${edge.injectAtAssistantTurn}`);
    console.log(`  input: "${edge.userInput.slice(0, 100)}${edge.userInput.length > 100 ? "..." : ""}"`);
    console.log("=".repeat(70));
    const t0 = Date.now();
    const child = spawn("node", ["qa/smoke-test.js", edge.scenarioId], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        SMOKE_BASE_URL: BASE_URL,
        SMOKE_OUT_SUFFIX: suffix,
        EDGE_CASE_INJECT: JSON.stringify({
          injectAtAssistantTurn: edge.injectAtAssistantTurn,
          userInput: edge.userInput,
        }),
        EDGE_CASE_CONTINUE: String(edge.continueTurns ?? 2),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("exit", (code) => {
      const dur = Math.round((Date.now() - t0) / 1000);
      const out = path.join(FINDINGS_DIR, `smoke-test-${edge.scenarioId}${suffix}.json`);
      resolve({
        id: edge.id,
        category: edge.category,
        scenarioId: edge.scenarioId,
        exitCode: code,
        durSec: dur,
        transcriptFile: out,
        transcriptExists: fs.existsSync(out),
      });
    });
  });
}

// Judge with Claude: feed each transcript + expected behavior to the model and
// classify the AI's handling.
async function judge(edge, transcript) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { rating: "NOT_JUDGED", reason: "no API key" };
  }
  // Build the prompt: show the AI's response immediately after the injection
  // and ask the judge to classify it against the expected behavior.
  const raw = transcript.rawAssistantMsgs || [];
  // The AI message AFTER the injection is at index = injectAtAssistantTurn
  // (since turn N was the trigger, turn N+1 is the response; raw is 0-indexed
  // so the response is at index injectAtAssistantTurn).
  const responseIndex = edge.injectAtAssistantTurn; // 0-indexed (turn-1 in 1-indexed terms)
  const beforeContext = raw[responseIndex - 1] || ""; // the AI msg that triggered injection
  const responseToInjection = raw[responseIndex] || "(no response captured)";
  const followUp = raw[responseIndex + 1] || "";

  const judgePrompt = [
    "You are evaluating how a virtual urology consultation AI handled an unusual or disruptive patient message.",
    "",
    "EDGE CASE BEING TESTED:",
    `Category: ${EDGE_CATEGORIES[edge.category]}`,
    `Description: ${edge.id}`,
    "",
    "WHAT THE AI SAID JUST BEFORE THE PATIENT'S DISRUPTIVE INPUT:",
    beforeContext.replace(/<!--\s*qid:[^>]+-->/g, "").trim(),
    "",
    `WHAT THE PATIENT TYPED (the disruption being tested):`,
    `"${edge.userInput}"`,
    "",
    "HOW THE AI RESPONDED:",
    responseToInjection.replace(/<!--\s*qid:[^>]+-->/g, "").trim(),
    "",
    followUp ? "AI's NEXT MESSAGE AFTER THAT (if any):\n" + followUp.replace(/<!--\s*qid:[^>]+-->/g, "").trim() + "\n" : "",
    "EXPECTED BEHAVIOR (what would be a good response):",
    edge.expectedBehavior,
    "",
    "Classify the AI's handling on a 1-5 scale:",
    "  5 = excellent — handled the disruption gracefully and met the expected behavior",
    "  4 = good — minor flaws but largely correct",
    "  3 = acceptable — handles it but with notable gaps",
    "  2 = poor — partially misses the point or feels off",
    "  1 = bad — wrong, unsafe, or ignores the disruption entirely",
    "",
    "Respond in this EXACT format:",
    "RATING: <1-5>",
    "REASON: <one or two sentences>",
  ].join("\n");

  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 250,
    messages: [{ role: "user", content: judgePrompt }],
  });
  const text = resp.content[0]?.text || "";
  const ratingMatch = text.match(/RATING:\s*([1-5])/i);
  const reasonMatch = text.match(/REASON:\s*([\s\S]+?)$/i);
  return {
    rating: ratingMatch ? parseInt(ratingMatch[1], 10) : null,
    reason: reasonMatch ? reasonMatch[1].trim() : text.trim(),
    aiResponse: responseToInjection.replace(/<!--\s*qid:[^>]+-->/g, "").trim(),
  };
}

(async () => {
  const filter = process.argv[2];
  const cases = selectCases(filter);
  console.log(`Running ${cases.length} edge-case tests...`);
  if (filter) console.log(`Filter: ${filter}`);

  const results = [];
  for (const edge of cases) {
    const result = await runOne(edge);
    results.push(result);
  }

  console.log("\n" + "=".repeat(70));
  console.log("JUDGING RESPONSES");
  console.log("=".repeat(70));

  const judgments = [];
  for (const r of results) {
    const edge = EDGE_CASES.find((e) => e.id === r.id);
    if (!r.transcriptExists) {
      judgments.push({ ...r, judgment: { rating: null, reason: "transcript missing" } });
      console.log(`[${r.id}] (no transcript)`);
      continue;
    }
    if (!SHOULD_JUDGE) {
      judgments.push({ ...r, judgment: null });
      continue;
    }
    try {
      const transcript = JSON.parse(fs.readFileSync(r.transcriptFile, "utf8"));
      const judgment = await judge(edge, transcript);
      judgments.push({ ...r, judgment });
      const ratingStr = judgment.rating !== null ? `${judgment.rating}/5` : "?";
      console.log(`[${r.id}] ${ratingStr} — ${judgment.reason.slice(0, 120)}`);
    } catch (e) {
      console.log(`[${r.id}] judge failed: ${e.message}`);
      judgments.push({ ...r, judgment: { error: String(e.message || e) } });
    }
  }

  // Final report
  const report = {
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    judgments,
    byCategory: {},
  };
  for (const cat of Object.keys(EDGE_CATEGORIES)) {
    const inCat = judgments.filter((j) => j.category === cat);
    if (!inCat.length) continue;
    const rated = inCat.filter((j) => j.judgment?.rating);
    report.byCategory[cat] = {
      name: EDGE_CATEGORIES[cat],
      count: inCat.length,
      avgRating: rated.length
        ? Math.round((rated.reduce((s, j) => s + j.judgment.rating, 0) / rated.length) * 10) / 10
        : null,
      worst: rated.length ? Math.min(...rated.map((j) => j.judgment.rating)) : null,
    };
  }
  const outPath = path.join(FINDINGS_DIR, "edge-case-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY BY CATEGORY");
  console.log("=".repeat(70));
  console.table(report.byCategory);
  console.log(`\n→ wrote ${path.relative(path.join(__dirname, ".."), outPath)}`);

  // Highlight low-rated cases
  const lows = judgments.filter((j) => j.judgment?.rating && j.judgment.rating <= 2);
  if (lows.length) {
    console.log("\n" + "=".repeat(70));
    console.log(`LOW-RATED CASES (≤2/5) — ${lows.length} item${lows.length === 1 ? "" : "s"}`);
    console.log("=".repeat(70));
    for (const l of lows) {
      console.log(`\n[${l.id}] ${l.judgment.rating}/5`);
      console.log(`  reason: ${l.judgment.reason}`);
      console.log(`  AI said: ${l.judgment.aiResponse?.slice(0, 200)}...`);
    }
  }
})();
