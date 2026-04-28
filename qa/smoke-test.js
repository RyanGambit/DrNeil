/**
 * Smoke test — drive the real UI for one scenario via Puppeteer and verify
 * the consultation reaches a sensible outcome.
 *
 * Run:    node qa/smoke-test.js
 * Output: qa-findings/smoke-test-<scenarioId>.json
 *
 * Assumes dev server is already running on localhost:3000.
 */

require("dotenv").config({ path: ".env.local", override: true });

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { generatePatientReply, cleanText } = require("./patient-sim");

const SCENARIO_ID = process.argv[2] || "ed-1";
const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "..", "qa-findings");
const OUT_FILE = path.join(OUT_DIR, `smoke-test-${SCENARIO_ID}.json`);
const MAX_TURNS = 80;
const ASSISTANT_TIMEOUT_MS = 60_000;

// Pull the SCENARIO_DB entry by parsing app/page.jsx — not as fragile as it
// sounds because we just need the .data block for the patient simulator.
function loadScenario(id) {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "app", "page.jsx"), "utf8");
  const startMarker = `id: "${id}"`;
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`Scenario ${id} not found in SCENARIO_DB`);

  // Walk forward to the closing brace of this scenario object.
  let depth = 0;
  let i = src.lastIndexOf("{", startIdx);
  const objStart = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const objSrc = src.slice(objStart, i + 1);
  // eslint-disable-next-line no-eval
  const obj = eval(`(${objSrc})`);
  return obj;
}

const scenario = loadScenario(SCENARIO_ID);

console.log(`\n=== SMOKE TEST: ${SCENARIO_ID} ===`);
console.log(`Patient: ${scenario.data.name}, ${scenario.data.age}, ${scenario.condition.toUpperCase()}`);
console.log(`Expected: ${scenario.label}\n`);

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--window-size=1280,900"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Capture every /api/chat response so we keep the raw assistant text
  // (including <!-- qid:X --> markers) — the DOM strips them.
  const apiTranscript = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/chat")) return;
    try {
      const json = await response.json();
      apiTranscript.push({
        ts: Date.now(),
        url,
        status: response.status(),
        body: json,
      });
    } catch (e) {
      // Some chat responses may stream — fall back to text.
      try {
        const txt = await response.text();
        apiTranscript.push({ ts: Date.now(), url, status: response.status(), bodyText: txt });
      } catch {}
    }
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("  [browser:error]", msg.text());
  });

  const shotDir = path.join(OUT_DIR, `smoke-${SCENARIO_ID}-shots`);
  if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
  const shot = async (name) => {
    try { await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true }); } catch {}
  };

  console.log("[1] Navigating to app...");
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30_000 });
  await shot("01-welcome");

  console.log("[2] Welcome screen — entering name...");
  await page.waitForSelector("#welcome-first-name", { timeout: 10_000 });
  const [firstName, ...rest] = scenario.data.name.split(" ");
  const lastName = rest.join(" ") || "Patient";
  await page.click("#welcome-first-name");
  await page.type("#welcome-first-name", firstName, { delay: 30 });
  await page.click("#welcome-last-name");
  await page.type("#welcome-last-name", lastName, { delay: 30 });
  await new Promise(r => setTimeout(r, 200));
  await shot("02a-name-typed");
  // Verify state and button enabled
  const buttonState = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /start your session/i.test(b.textContent));
    return {
      found: !!btn,
      disabled: btn?.disabled,
      firstNameVal: document.querySelector("#welcome-first-name")?.value,
      lastNameVal: document.querySelector("#welcome-last-name")?.value,
    };
  });
  console.log("  button state:", JSON.stringify(buttonState));
  const welcomeStarted = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /start your session/i.test(b.textContent));
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  });
  if (!welcomeStarted) {
    await shot("02b-failed-button-disabled");
    throw new Error(`Could not click 'Start Your Session' — disabled=${buttonState.disabled}`);
  }
  await new Promise(r => setTimeout(r, 1200));
  await shot("02c-after-welcome-click");

  console.log("[3] Upload screen — selecting test scenario...");
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => /test scenarios/i.test(b.textContent)),
      { timeout: 10_000 },
    );
  } catch (e) {
    await shot("03a-failed-no-test-scenarios-tab");
    const btns = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).slice(0, 30));
    console.log("  buttons on page:", JSON.stringify(btns));
    throw e;
  }
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().endsWith("Test Scenarios"));
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Click the scenario card whose first <span> text === patient name
  const scenarioClicked = await page.evaluate((targetName) => {
    const candidates = [...document.querySelectorAll('div[style*="cursor"]')];
    const card = candidates.find((c) => {
      const span = c.querySelector("span");
      return span && span.textContent.trim() === targetName;
    });
    if (card) { card.click(); return true; }
    return false;
  }, scenario.data.name);
  if (!scenarioClicked) throw new Error(`Could not click scenario card for ${scenario.data.name}`);
  await new Promise(r => setTimeout(r, 500));

  // Click "Begin Virtual Consultation"
  const startClicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /begin virtual consultation/i.test(b.textContent));
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  });
  if (!startClicked) {
    await shot("03-failed-no-begin-button");
    throw new Error("Could not click 'Begin Virtual Consultation' (patient data may not have loaded)");
  }
  await shot("03-after-begin-click");

  console.log("[4] Chat — waiting for first assistant message...");
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('[role="log"] img[alt=""]').length >= 1,
      { timeout: ASSISTANT_TIMEOUT_MS },
    );
  } catch (e) {
    await shot("04-failed-no-first-message");
    const snippet = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log("  page innerText snippet:", snippet);
    throw e;
  }
  await shot("04-first-message-arrived");

  // Helper: extract messages from DOM as [{role, text}]
  // Skips the typing-dots indicator (animation-delay spans) and the
  // "Consultation Complete" outro card.
  async function extractMessages() {
    return await page.evaluate(() => {
      const log = document.querySelector('[role="log"]');
      if (!log) return [];
      const msgs = [];
      const wrappers = [...log.children].filter((el) => el.tagName === "DIV");
      for (const wrap of wrappers) {
        // Skip typing indicator: structure has `<span>●</span>` x3 OR text === ● ● ●
        const wrapText = (wrap.textContent || "").trim();
        if (/^[●·•\s]+$/.test(wrapText)) continue;
        if (wrap.querySelector('span[style*="animation"]')) continue;
        // Skip "Consultation Complete" outro
        if (/Consultation Complete/i.test(wrapText)) continue;

        const rows = [...wrap.children].filter((el) => el.tagName === "DIV");
        const bubbleRow = rows[0];
        if (!bubbleRow) continue;
        const justify = bubbleRow.style?.justifyContent || "";
        const hasAvatar = !!bubbleRow.querySelector('img[alt="Dr. Fleshner"], img[alt=""]');
        const bubbles = [...bubbleRow.children].filter((el) => el.tagName === "DIV");
        const bubbleEl = bubbles[bubbles.length - 1];
        if (!bubbleEl) continue;
        const text = (bubbleEl.innerText || bubbleEl.textContent || "").trim();
        if (!text) continue;
        const role = justify.includes("flex-end") ? "user" : "assistant";
        msgs.push({ role, text });
      }
      return msgs;
    });
  }

  // Helper: detect chip card visible for the most recent assistant message
  async function readChipsAndCard() {
    return await page.evaluate(() => {
      // ResponseCard renders all buttons inside a div with marginLeft 48 and a border
      // After the most recent assistant bubble.
      const cards = [...document.querySelectorAll('[role="log"] div')].filter((d) => {
        const s = d.style;
        return s.marginLeft === "48px" && s.border && s.border.includes("solid");
      });
      const card = cards[cards.length - 1];
      if (!card) return { chips: null };
      // Scored chips render letter badge (a/b/c/d/e) in a separate <span>,
      // then the label. innerText concatenates with newline. Drop a single-letter
      // first line so chips read as the label only — matches what the patient sees
      // and what the prod UI sends back via handleChipTap.
      const chips = [...card.querySelectorAll("button")]
        .map((b) => {
          const raw = (b.innerText || b.textContent || "").trim();
          const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
          if (lines.length > 1 && /^[a-g]$/i.test(lines[0])) lines.shift();
          return lines.join(" ").replace(/^[a-g]\)\s*/i, "");
        })
        .filter(Boolean);
      return { chips: chips.length ? chips : null };
    });
  }

  // Helper: detect end of session
  async function isEnded() {
    return await page.evaluate(() => {
      return !!document.querySelector('[role="log"]') &&
        document.body.innerText.includes("Consultation Complete");
    });
  }

  // Helper: wait until the assistant stops typing (typing dots disappear)
  // and at least one real (non-typing) message bubble is rendered after the
  // most recent user turn.
  async function waitForAssistantIdle(prevAssistantCount) {
    await page.waitForFunction(
      (prev) => {
        const log = document.querySelector('[role="log"]');
        if (!log) return false;
        // Still typing if any animation-named inline style exists
        if (log.querySelector('span[style*="animation"]')) return false;
        let count = 0;
        for (const wrap of [...log.children]) {
          if (wrap.tagName !== "DIV") continue;
          const t = (wrap.textContent || "").trim();
          if (/^[●·•\s]+$/.test(t)) continue;
          if (/Consultation Complete/i.test(t)) continue;
          const row = wrap.querySelector(":scope > div");
          if (!row) continue;
          if (!(row.style?.justifyContent || "").includes("flex-end")) count++;
        }
        return count > prev;
      },
      { timeout: ASSISTANT_TIMEOUT_MS, polling: 500 },
      prevAssistantCount,
    );
    await new Promise(r => setTimeout(r, 400));

    // Stability check — typing dots can disappear briefly mid-stream between
    // paragraphs of a multi-paragraph message. Poll the last assistant bubble's
    // text length until it stops growing for 800ms. Bail after 6s either way.
    const stabilityStart = Date.now();
    let lastLen = -1;
    let stableSince = Date.now();
    while (Date.now() - stabilityStart < 6000) {
      const len = await page.evaluate(() => {
        const log = document.querySelector('[role="log"]');
        if (!log) return 0;
        const wraps = [...log.children].filter((w) => w.tagName === "DIV");
        for (let i = wraps.length - 1; i >= 0; i--) {
          const wrap = wraps[i];
          const t = (wrap.textContent || "").trim();
          if (/^[●·•\s]+$/.test(t)) continue;
          if (/Consultation Complete/i.test(t)) continue;
          const row = wrap.querySelector(":scope > div");
          if (!row) continue;
          if ((row.style?.justifyContent || "").includes("flex-end")) continue;
          const bubbles = [...row.children].filter((el) => el.tagName === "DIV");
          const last = bubbles[bubbles.length - 1];
          return last ? (last.innerText || "").length : 0;
        }
        return 0;
      });
      const stillTyping = await page.evaluate(() => {
        const log = document.querySelector('[role="log"]');
        return !!(log && log.querySelector('span[style*="animation"]'));
      });
      if (stillTyping || len !== lastLen) {
        lastLen = len;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= 800) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("[5] Driving conversation...\n");
  let lastAssistantCount = 0;
  let usage = { input_tokens: 0, output_tokens: 0 };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    try {
      await waitForAssistantIdle(lastAssistantCount);
    } catch (e) {
      console.log(`  [stall] timed out waiting for assistant (had ${lastAssistantCount} msgs) — breaking`);
      await shot(`stall-turn-${turn}`);
      break;
    }
    const messages = await extractMessages();
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    lastAssistantCount = assistantMsgs.length;

    if (await isEnded()) {
      console.log("  ✓ Consultation ended");
      break;
    }

    const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
    if (!lastAssistant) break;

    console.log(`  [Dr] ${lastAssistant.text.replace(/\s+/g, " ").slice(0, 120)}${lastAssistant.text.length > 120 ? "…" : ""}`);

    const { chips } = await readChipsAndCard();
    if (chips) console.log(`        chips: [${chips.map(c => c.length > 30 ? c.slice(0, 27) + "…" : c).join(" | ")}]`);

    const { text, chipPicked, usage: u } = await generatePatientReply(scenario, messages, chips);
    if (u) { usage.input_tokens += u.input_tokens || 0; usage.output_tokens += u.output_tokens || 0; }

    console.log(`  [Pt] ${text}\n`);

    if (chipPicked) {
      // Click the chip
      const clicked = await page.evaluate((label) => {
        const cards = [...document.querySelectorAll('[role="log"] div')].filter((d) => {
          const s = d.style;
          return s.marginLeft === "48px" && s.border && s.border.includes("solid");
        });
        const card = cards[cards.length - 1];
        if (!card) return false;
        // Match cleaned button text — same normalization as readChipsAndCard:
        // drop a single-letter first line (scored chip badge) and any "a) " prefix.
        const norm = (s) => {
          const lines = s.split(/\n+/).map((l) => l.trim()).filter(Boolean);
          if (lines.length > 1 && /^[a-g]$/i.test(lines[0])) lines.shift();
          return lines.join(" ").replace(/^[a-g]\)\s*/i, "").trim();
        };
        const target = norm(label);
        const btn = [...card.querySelectorAll("button")].find((b) => norm(b.innerText || b.textContent || "") === target);
        if (btn) { btn.click(); return true; }
        return false;
      }, chipPicked);
      if (!clicked) {
        console.warn(`  [warn] chip click failed for "${chipPicked}" — falling back to typing`);
        await page.click("#chat-input");
        await page.type("#chat-input", text);
        await page.keyboard.press("Enter");
      }
    } else {
      await page.click("#chat-input");
      await page.type("#chat-input", text);
      await page.keyboard.press("Enter");
    }

    // Brief pacing pause
    await new Promise(r => setTimeout(r, 400));
  }

  console.log("\n[6] Capturing final state...");
  const finalMessages = await extractMessages();
  const ended = await isEnded();

  // Try to capture SOAP if it auto-generates after end-consult
  let soap = null;
  if (ended) {
    try {
      // Click "End & Generate SOAP" if not already triggered
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /end & generate|end consult|generate soap/i.test(b.textContent));
        if (btn && !btn.disabled) btn.click();
      });
      await page.waitForFunction(
        () => /SOAP|Visit Summary/i.test(document.body.innerText) && !document.body.innerText.includes("Preparing your visit"),
        { timeout: 60_000 },
      ).catch(() => {});
      soap = await page.evaluate(() => {
        const node = document.querySelector("pre, [class*='soap']");
        return node ? node.innerText : null;
      });
    } catch (e) {
      console.log("  [soap] capture skipped:", e.message);
    }
  }

  // Marker analysis from raw API responses (DOM strips markers).
  // /api/chat route returns { content: [{ type: "text", text: "..." }, ...] }
  const rawAssistantMsgs = [];
  for (const entry of apiTranscript) {
    const body = entry.body;
    if (Array.isArray(body?.content)) {
      const text = body.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      if (text) rawAssistantMsgs.push(text);
    }
  }
  const markerCount = rawAssistantMsgs.filter((t) => /<!--\s*qid:/i.test(t)).length;
  const markerRate = rawAssistantMsgs.length ? (markerCount / rawAssistantMsgs.length) : 0;

  const result = {
    scenarioId: SCENARIO_ID,
    scenario: { id: scenario.id, condition: scenario.condition, label: scenario.label, summary: scenario.summary, patient: scenario.data.name },
    timestamp: new Date().toISOString(),
    turns: finalMessages.length,
    ended,
    finalMessages,
    rawAssistantMsgs,
    markers: { rawAssistantTurns: rawAssistantMsgs.length, withMarker: markerCount, rate: markerRate },
    soapNote: soap,
    usage,
    apiCallCount: apiTranscript.length,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n  → wrote ${OUT_FILE}`);
  console.log(`  turns: ${finalMessages.length}  ended: ${ended}  marker rate: ${(markerRate * 100).toFixed(0)}%`);
  console.log(`  sim tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`);

  await browser.close();
})().catch((e) => {
  console.error("\nFATAL:", e.stack || e);
  process.exit(1);
});
