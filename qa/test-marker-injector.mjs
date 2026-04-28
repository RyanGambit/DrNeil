import { injectMarker } from "../lib/marker-injector.js";
import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "qa-findings/smoke-test-ed-1.json"), "utf8"));
const msgs = data.rawAssistantMsgs;
let pre = 0, post = 0, injected = 0;
const unmatched = [];
for (const m of msgs) {
  const had = /<!--\s*qid:/i.test(m);
  if (had) pre++;
  const r = injectMarker(m, "ed");
  const hasNow = /<!--\s*qid:/i.test(r.text);
  if (hasNow) post++;
  if (r.injected) injected++;
  if (!hasNow) unmatched.push(m.slice(0, 110).replace(/\n/g, " | "));
}
console.log(`turns: ${msgs.length}`);
console.log(`marker rate before: ${pre}/${msgs.length} (${Math.round(pre/msgs.length*100)}%)`);
console.log(`marker rate after:  ${post}/${msgs.length} (${Math.round(post/msgs.length*100)}%)`);
console.log(`injected: ${injected}`);
console.log(`still unmatched: ${unmatched.length}`);
unmatched.forEach((m) => console.log("  -", m));
