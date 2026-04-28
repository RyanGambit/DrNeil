/**
 * Stability QA — drives the live Vercel deploy at multiple viewports
 * looking for crashes, hydration warnings, and console errors.
 *
 * Run after `node qa/smoke-test.js` confirms basic flow works.
 * Outputs qa-findings/stability-findings.json with per-viewport results.
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: ".env.local", override: true });

const BASE_URL = process.env.STAB_URL || "https://dr-neil-git-main-ryan-gambit.vercel.app";
const SHARE_TOKEN = process.env.STAB_SHARE_TOKEN || "xxKHwJuPfPhzOmFK0lTnfhWHkmlGcW8q";
const OUT_DIR = path.resolve(__dirname, "..", "qa-findings");
const SHOTS_DIR = path.join(OUT_DIR, "stability-shots");

const VIEWPORTS = [
  { name: "iphone-se",  width: 375,  height: 667, deviceScaleFactor: 2, isMobile: true,  hasTouch: true },
  { name: "iphone-14",  width: 390,  height: 844, deviceScaleFactor: 3, isMobile: true,  hasTouch: true },
  { name: "ipad",       width: 768,  height: 1024, deviceScaleFactor: 2, isMobile: true,  hasTouch: true },
  { name: "desktop",    width: 1280, height: 900,  deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

const findings = [];

(async () => {
  if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", `--window-size=${vp.width},${vp.height}`],
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width, height: vp.height,
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    });

    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];
    const networkFailures = [];

    page.on("console", (msg) => {
      const t = msg.type();
      const text = msg.text();
      if (t === "error") consoleErrors.push(text);
      else if (t === "warning") consoleWarnings.push(text);
    });
    page.on("pageerror", (err) => pageErrors.push(String(err.message || err)));
    page.on("requestfailed", (req) => {
      networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400 && !resp.url().includes("favicon")) {
        networkFailures.push({ url: resp.url(), status: resp.status() });
      }
    });

    try {
      // 1. Landing page load + hydration
      const landingUrl = `${BASE_URL}/?_vercel_share=${SHARE_TOKEN}`;
      await page.goto(landingUrl, { waitUntil: "networkidle0", timeout: 30_000 });
      await new Promise(r => setTimeout(r, 1500)); // catch deferred warnings
      await page.screenshot({ path: path.join(SHOTS_DIR, `${vp.name}-01-landing.png`), fullPage: false });

      // 2. Welcome → name entry → Start.
      // React controlled inputs ignore .value = ... assignment because
      // their value descriptor is shadowed. page.type() simulates real
      // keystrokes which fires React's onChange properly.
      const firstSel = await page.evaluate(() => {
        const i = [...document.querySelectorAll("input")].find(el =>
          /first/i.test((el.placeholder||"") + (el.name||"") + (el.id||""))
        );
        return i ? `#${i.id}` : null;
      });
      const lastSel = await page.evaluate(() => {
        const i = [...document.querySelectorAll("input")].find(el =>
          /last/i.test((el.placeholder||"") + (el.name||"") + (el.id||""))
        );
        return i ? `#${i.id}` : null;
      });
      if (firstSel) { await page.click(firstSel); await page.type(firstSel, "Test"); }
      if (lastSel)  { await page.click(lastSel);  await page.type(lastSel, "User"); }
      await new Promise(r => setTimeout(r, 400));
      await page.screenshot({ path: path.join(SHOTS_DIR, `${vp.name}-02-name-entered.png`) });

      const startClicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /start your session/i.test(b.textContent));
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (!startClicked) throw new Error("Start button not clickable");

      await page.waitForFunction(
        () => [...document.querySelectorAll("button")].some(b => /test scenarios/i.test(b.textContent)),
        { timeout: 10_000 }
      );
      await page.screenshot({ path: path.join(SHOTS_DIR, `${vp.name}-03-upload-screen.png`) });

      // 3. Pick test-scenarios tab + a scenario
      await page.evaluate(() => {
        const tab = [...document.querySelectorAll("button")].find(b => b.textContent.trim().endsWith("Test Scenarios"));
        if (tab) tab.click();
      });
      await new Promise(r => setTimeout(r, 400));
      const cardClicked = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('div[style*="cursor"]')];
        const c = cards.find(card => /David Park/i.test(card.textContent));
        if (c) { c.click(); return true; }
        return false;
      });
      if (!cardClicked) console.log("  (could not click scenario card)");
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: path.join(SHOTS_DIR, `${vp.name}-04-scenario-picked.png`) });

      // 4. Begin consultation
      const begun = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(b => /begin virtual consultation/i.test(b.textContent));
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (begun) {
        // wait for chat surface to render
        await page.waitForFunction(() => !!document.querySelector('[role="log"]'), { timeout: 30_000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 5000)); // wait for first AI message
        await page.screenshot({ path: path.join(SHOTS_DIR, `${vp.name}-05-chat-first-msg.png`), fullPage: false });

        // 5. Probe touch-target sizes for any visible chips
        const chipSizes = await page.evaluate(() => {
          const log = document.querySelector('[role="log"]');
          if (!log) return null;
          const cards = [...log.querySelectorAll('div')].filter(d => {
            const s = d.style;
            return s.marginLeft === "48px" && s.border && s.border.includes("solid");
          });
          const lastCard = cards[cards.length - 1];
          if (!lastCard) return null;
          return [...lastCard.querySelectorAll("button")].map(b => {
            const r = b.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height), text: b.innerText.slice(0,40) };
          });
        });

        // 6. Mic & send button sizes
        const inputBtnSizes = await page.evaluate(() => {
          const result = {};
          const send = document.querySelector('button[aria-label="Send message"]');
          const mic = document.querySelector('button[aria-label="Start voice input"], button[aria-label="Stop voice input"]');
          if (send) { const r = send.getBoundingClientRect(); result.send = { w: Math.round(r.width), h: Math.round(r.height) }; }
          if (mic) { const r = mic.getBoundingClientRect(); result.mic = { w: Math.round(r.width), h: Math.round(r.height) }; }
          return result;
        });

        findings.push({
          viewport: vp.name, width: vp.width, height: vp.height,
          chipSizes, inputBtnSizes,
          consoleErrors: dedupe(consoleErrors),
          consoleWarnings: dedupe(consoleWarnings).filter(w => !/Lit is in dev mode/.test(w)),
          pageErrors,
          networkFailures: networkFailures.slice(0, 10),
        });
      } else {
        findings.push({ viewport: vp.name, error: "Begin Virtual Consultation not clickable" });
      }
    } catch (e) {
      findings.push({ viewport: vp.name, fatal: String(e.message || e) });
      try { await page.screenshot({ path: path.join(SHOTS_DIR, `${vp.name}-FATAL.png`) }); } catch {}
    } finally {
      await browser.close();
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, "stability-findings.json"), JSON.stringify(findings, null, 2));
  console.log("\n→ wrote qa-findings/stability-findings.json");
  console.log("→ screenshots in qa-findings/stability-shots/");
})();

function dedupe(arr) {
  return [...new Set(arr)];
}
