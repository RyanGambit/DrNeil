/**
 * Quick localhost-only hydration smoke check.
 * Loads the welcome page at multiple viewports and counts React errors.
 */
const puppeteer = require("puppeteer");

const URL = process.env.HCHECK_URL || "http://localhost:3000/";
const VIEWPORTS = [
  { name: "iphone-se",  width: 375,  height: 667 },
  { name: "desktop",    width: 1280, height: 900 },
];

(async () => {
  for (const vp of VIEWPORTS) {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e.message || e)));
    page.on("console", (m) => {
      if (m.type() === "error") errs.push("[console] " + m.text());
    });
    page.on("response", (r) => {
      if (r.status() === 404) errs.push("[404] " + r.url());
    });

    await page.goto(URL, { waitUntil: "networkidle0", timeout: 15_000 });
    await new Promise(r => setTimeout(r, 1500));

    const reactErrs = errs.filter(e => /Minified React error|Hydration|hydrat/i.test(e));
    console.log(`${vp.name} (${vp.width}px) — total errors: ${errs.length}, React/hydration: ${reactErrs.length}`);
    reactErrs.forEach(e => console.log("  ----\n  " + e.replace(/\n/g, "\n  ")));
    // Print non-React errors too
    errs.filter(e => !/Minified React|Hydration|hydrat/i.test(e)).forEach(e => console.log("  [other]", e.slice(0, 200)));
    await browser.close();
  }
})();
