/**
 * Visual QA of the new tester-mode welcome flow.
 * Captures screenshots at each stage so we can review the UX.
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = process.env.HCHECK_URL || "http://localhost:3000/";
const OUT = path.resolve(__dirname, "..", "qa-findings", "tester-flow-shots");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 15_000 });
  await new Promise(r => setTimeout(r, 800));

  // Stage 1 — mode select
  await page.screenshot({ path: path.join(OUT, "01-mode-select.png") });

  // Pick "I'm a tester"
  const clickedTester = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /evaluate the tool/i.test(b.textContent));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clickedTester) { console.log("FAIL: tester button not found"); process.exit(1); }
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, "02-tester-form.png") });

  // Fill name + role
  await page.click("#welcome-first-name");
  await page.type("#welcome-first-name", "Sarah");
  await page.click("#welcome-last-name");
  await page.type("#welcome-last-name", "Chen");
  await page.evaluate(() => {
    const sel = document.getElementById("welcome-role");
    if (sel) {
      sel.value = "urologist";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, "03-tester-form-filled.png") });

  // Start session — should land on upload screen with no Upload File tab
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /start your session/i.test(b.textContent));
    if (btn && !btn.disabled) btn.click();
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(b => /test scenarios/i.test(b.textContent)),
    { timeout: 10_000 }
  );
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, "04-tester-upload-no-file-tab.png") });

  // Confirm tabs are exactly Test Scenarios + Build Your Own
  const tabs = await page.evaluate(() => {
    return [...document.querySelectorAll('button[aria-pressed]')]
      .map(b => b.textContent.trim())
      .filter(t => /scenarios|file|build/i.test(t));
  });
  console.log("Tabs visible (tester mode):", JSON.stringify(tabs));

  // Now check patient flow has all 3 tabs — go back, pick patient
  await page.evaluate(() => {
    const back = [...document.querySelectorAll("button")].find(b => /back/i.test(b.textContent));
    // Click the actual <- Back button on welcome (only present after mode select)
    // First nav back to welcome
  });

  await page.goto(URL, { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /i'm a patient/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.click("#welcome-first-name");
  await page.type("#welcome-first-name", "Test");
  await page.click("#welcome-last-name");
  await page.type("#welcome-last-name", "Patient");
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /start your session/i.test(b.textContent));
    if (btn && !btn.disabled) btn.click();
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(b => /test scenarios/i.test(b.textContent)),
    { timeout: 10_000 }
  );
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, "05-patient-upload-all-tabs.png") });
  const patientTabs = await page.evaluate(() => {
    return [...document.querySelectorAll('button[aria-pressed]')]
      .map(b => b.textContent.trim())
      .filter(t => /scenarios|file|build/i.test(t));
  });
  console.log("Tabs visible (patient mode):", JSON.stringify(patientTabs));

  console.log(`\nTotal console/page errors: ${errs.length}`);
  errs.slice(0, 5).forEach(e => console.log("  -", e.slice(0, 150)));
  await browser.close();
})();
