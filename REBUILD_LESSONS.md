# Registry-Driven Consultation Rebuild — Lessons Learned

**Context for preparing the BPH (or MH) version.** This document captures every architectural decision, failure mode, and pattern we earned during the ED rebuild so the next consultation lands near-complete on the first pass.

---

## 1. What We Built (Recap)

The ED consultation has three decoupled layers:

1. **Registry** (`prompts/ed-question-registry.js`) — single source of truth. Every predefined question, its chips, layout, routing, and progress cue lives here.
2. **Prompt** (`prompts/ed.js`) — clinical reasoning engine. Tells the AI how to deliver questions from the registry, when to branch, and how to deliver outcomes.
3. **Frontend** (`app/page.jsx`) — renders the registry's UI. Reads a hidden `<!-- qid:X -->` marker from the AI's message, looks up the registry entry, shows the right chips.

The AI's job is narrow: deliver predefined questions verbatim, append the qid marker, apply response-control rules, make clinical decisions, and deliver outcomes. The AI does **not** write questions.

---

## 2. Registry File Format (Canonical)

Each entry has these fields:

```javascript
{
  id: "unique-kebab-case-id",
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7,   // consult phase number
  type: "confirm-panel",               // optional; only for stacked intake
  question: "Exact verbatim text",     // or null for contextual messages
  chips: ["Chip 1", "Chip 2", ...],    // or null for open text
  layout: "horizontal" | "scored",     // horizontal default; scored for a-e
  condition: "some_readable_condition" | null,  // branching (AI reads)
  progressCue: "Text prepended before question" | null,
  routing: { "Chip 1": "continue", "Chip 2": "outcome_c_reason" },
  notes: "Clinical or implementation guidance"
}
```

**Key rules for this schema:**
- `chips: null` → open text question, frontend renders no ResponseCard, patient types in main input
- `type: "confirm-panel"` → renders the stacked intake ConfirmPanel instead of chips (the ONE stacked exception)
- `question: null` → AI delivers contextually (e.g., drip-feed outcome messages); marker still required
- `layout: "scored"` → vertical cards with letter badges (a, b, c, d, e); frontend strips `a) ... e) ...` lines from the bubble since ResponseCard renders them
- `condition` → human-readable flag the AI uses for branching (e.g., `"smoking != Never"`); the frontend doesn't evaluate it

---

## 3. The Three-Layer Fallback for Marker Resolution

The AI will sometimes drop the qid marker. Three layers catch this:

1. **Direct marker** — `<!-- qid:X -->` parsed from end of message → registry lookup
2. **Text match** — if no marker, substring-match the message against each registry entry's `question` field (min 15 chars, longest-first for specificity)
3. **Contextual rephrase** — if the message has a `?` and the patient's last reply matched `/^(not sure|maybe|idk|i don't know|unsure|...)$/i`, reuse the **previous** assistant's qid (the AI is rephrasing)

If all three fail → no chips render. Patient still has the main chat input.

**Implementation detail:** `parseQID()` also trims leading/trailing whitespace and collapses 3+ newlines to `\n\n` so stray AI formatting doesn't create blank lines at the top of bubbles.

---

## 4. Prompt Structure (What the AI Needs to See)

The prompt needs these blocks at the top, in this order:

1. **ABSOLUTE OUTPUT RULE** — never output internal checklists or reasoning
2. **QUESTION DELIVERY RULE** — deliver predefined questions verbatim; allowed to add transitions/acknowledgments but not rewrite
3. **QUESTION MARKER RULE** — mandatory `<!-- qid:X -->` on every predefined question. Include:
   - Examples of brief/missable questions that need markers
   - **REPHRASE RULE**: rephrased versions reuse the SAME qid
   - List of all markers for contextual messages (e.g., outcome B drip-feed acks)
4. **Response Control Rules** (4 rules):
   - Rule 1: Chip response → record and continue
   - Rule 2: Off-topic/nonsensical → redirect to same question
   - Rule 3: Clarifying question → answer briefly, re-present same question
   - Rule 4: Non-committal → record as uncertain, move on
5. **Stacking exception**: intake confirmations ONLY (everything else is one-question-per-message)

Then per-question, every predefined question in the phases should be annotated with:

```
Ask EXACTLY: "verbatim question text"
Chips: "Chip 1" / "Chip 2" / "Chip 3"
Append: <!-- qid:registry-id -->
```

This redundancy is essential. The more times the AI sees the exact chip labels and marker, the more reliably it delivers them.

---

## 5. UX Conventions (ResponseCard Pattern)

The ResponseCard is the sole chip-rendering component. Design rules:

- **Chips only inside the card** — no text field, no "OR TYPE" divider
- **Hint text below chips**: "You can also type a response below"
- **Main chat input at the bottom of the screen is always available** — it's the typed escape hatch
- **Tap → 300ms animation → send as plain text → card disappears**
- **Scored layout** (a-e letter badges) used only for severity questionnaires (SHIM in ED, IPSS in BPH)
- **Horizontal flex-wrap chips** for everything else

### The "Something else" Pattern for Open-ish Questions

Some questions that were originally open text got converted to chips + "Something else" escape:

- `clinical-q8-bother` — what bothers you most
- `partner-handling` — how is your partner handling this
- `clinical-q7f-why-stopped` — why did the med not work

**Critical rule**: "Something else" is a **terminal answer**. The AI records it and moves on. Do NOT add an open-text follow-up like "tell me more" — that creates friction without clinical value. If the patient genuinely wants to elaborate, they use the main chat input.

### What Stays Open Text

- Questions that need a specific typed value (age, medication name + dose)

Not every open-ish question needs chips. Use judgment — if chips can't capture the common cases, leave it open.

---

## 6. Panel State (Double-Submit Bug)

`ConfirmPanel` (intake confirmations) and the deleted `YesNoPanel` originally used local `useState` for their row-level response tracking. This caused a double-submit bug: after `sendToAPI()` triggered a re-render, React would unmount/remount the components, wiping local state, so the panel reappeared with selections lost.

**Fix:** move response/answer state to a parent-level `panelStates` object keyed by `messageIndex`. Components read from `panelStates[messageIndex]` and write via `setPanelStates`. State persists across re-renders.

If you introduce any new panel component for BPH (e.g., a stacked IPSS panel — probably a bad idea, but if), use the same parent-state pattern.

---

## 7. Reframing Questions for Green/Red Semantics

The original safety-gate questions had double negatives like:
> "Can you confirm you're **not** on nitroglycerin?"
> Yes = safe (no nitrates), No = flagged (on nitrates)

UI showed Yes in green, No in red. When patient answered "Yes" (safe), green showed — good. When "No" (unsafe), red showed — good. But the double negative confused patients and made the question hard to read.

**Lesson:** reframe questions so the positive answer is the direct, natural response. Avoid `"Can you confirm you're not..."`, `"Are you free of..."`, `"Is it safe to say you've never..."`.

Current pattern: ask the question plainly, put the worst-case answer last in the chip list so patients visually parse `[safe, safe, warning]` left-to-right.

---

## 8. Compound Questions — DON'T

The original safety gate had:
> "Is it safe to say you've never had an erection that wouldn't go down for hours, **and** no sickle cell disease?"

Two unrelated conditions, one question. Patient can answer Yes with sickle cell and clinically we miss it.

**Lesson:** one clinical concept per question. Priapism and sickle cell are separate registry entries now (`sg-q4-priapism`, `sg-q5-sickle-cell`).

---

## 9. Progress Bar — Registry-Index-Based, Not LLM-Classified

Originally progress came from a `/api/analyze` LLM call that classified the phase into 7 coarse buckets (`opening`, `intake`, `questionnaire`, `follow_up`, `safety_gate`, `outcome_delivery`, `closed`). Problems:
- Phase `follow_up` covered 8+ clinical questions → bar stuck at 70% for ages
- LLM classification lagged behind reality
- Big jumps between phases felt unrealistic

**Fix:** compute progress from the registry index of the most recent resolvable qid:
```javascript
pct = Math.round(3 + (registryIdx / (total - 1)) * 95)
```

- First qid = 3%, last = 98%, 100% reserved for terminal signals
- Terminal detection: `[Schedule X]` link, "Take care" sign-off, ER safety close
- Label derived from the registry entry's `phase` field (1 = "Getting started", 7 = "Wrapping up")

For BPH: decide on phase numbering, name each phase for the progress label, and the rest follows automatically.

---

## 10. Drip-Feed Outcome Delivery

ED Outcome B (prescription) splits into 3 messages:
1. Medication details → marker `outcome-b-ack-1` → chips `["Got it", "I have a question"]`
2. Side effects / what to expect → marker `outcome-b-ack-2` → chips `["Makes sense", "I have a question"]`
3. Follow-up + safety close → NO marker (terminal message)

This pattern prevents information overload. The ack chips force the patient to actively confirm each chunk before the next arrives.

For BPH: likely similar for medical therapy delivery (alpha-blockers, 5-ARIs, behavioral). Or for surgical referral explanations.

---

## 11. Known Failure Modes / Anti-Patterns

### Things we tried and abandoned

1. **AI-generated tags** (`[COMPONENT:type|opt1|opt2]`) — AI compliance was ~70%. Never reliable enough.
2. **Pure keyword matching** (no AI tags, frontend scans message for phrases) — worked 85% but fragile on rephrases, unusual AI wording.
3. **Stacked CV / Safety gate panels** — fragile to AI not structuring the message as expected, compound questions inside, confusing reframed wording.
4. **Text input inside ResponseCard** — patients typed free text and the AI went off-script. Removed.
5. **Open-text follow-up on "Something else"** — added friction, no clinical value. Removed.
6. **LLM-classified phase for progress** — too coarse, too slow. Replaced with registry-index.

### Things the AI consistently gets wrong

1. **Drops the qid marker on brief follow-up questions** ("And roughly how many years?", "Sound good so far?"). Solution: explicit examples in prompt + text-match fallback + contextual rephrase fallback.
2. **Drops the marker when rephrasing** after patient says "Not sure". Solution: REPHRASE RULE in the prompt + contextual fallback.
3. **Uses gendered pronouns for partner** despite explicit rule. Solution: HARD GENDER RULE repeated in the outcome delivery section.
4. **Combines smoking sub-questions** into one message. Solution: explicit 6a / 6b / 6c breakdown with "Do NOT combine" instruction.
5. **Ignores progress cues** when summarizing or being efficient. Solution: mark each progress cue as REQUIRED in the prompt.
6. **Starts messages with a blank line or extra newline**. Solution: frontend trims whitespace on parseQID.

---

## 12. What to Prepare for BPH

The BPH consultation has a parallel structure but different content:

### Clinical layers
- **Severity questionnaire**: IPSS (7 symptom questions + QoL, all 0–5 scored) — analogous to SHIM, use `layout: "scored"` with 0–5 range
- **Intake**: demographics, meds (listen for alpha-blockers, 5-ARIs, anticholinergics), comorbidities, prior prostate history
- **Clinical phenotype questions**: obstructive vs. storage vs. nocturnal polyuria vs. other. Different branching than ED's organic/psychogenic split.
- **Labs/imaging review**: PSA, free PSA ratio, PVR, prostate volume, uroflowmetry, creatinine, urinalysis
- **Outcomes** differ from ED:
  - A: Watchful waiting + lifestyle
  - B: Medical therapy (alpha-blocker / 5-ARI / combo / anticholinergic for storage / desmopressin for nocturia)
  - C: In-person (surgical candidate assessment, hematuria workup, elevated PSA)
  - D: Additional testing (PSA, imaging, cystoscopy)

### Decisions to make upfront
1. **Phase numbering** — probably 7 phases matching ED, but content differs
2. **Which intake questions need chips vs. open text** — same principle: chips for common cases with "Something else" escape; open text for values (age, meds, PSA reading)
3. **Stacked intake confirm** — yes, keep the same ConfirmPanel pattern for referral-data confirmation
4. **IPSS layout** — each question likely scored 0–5, 6 options per question (0/1/2/3/4/5 or `a) Never`, `b) Less than 1 in 5 times`, etc.). Use `layout: "scored"`.
5. **Conditional branching** — e.g., "nocturia-heavy" symptom cluster → probe for nocturnal polyuria → may route to desmopressin vs. alpha-blocker
6. **Safety gate for BPH meds** — lighter than ED. Mostly alpha-blocker interactions (orthostatic hypotension + existing BP meds) and 5-ARI PSA-suppression counseling.

### Apply these rules verbatim
- Every predefined question → registry entry + qid marker
- One question per message except intake confirm
- Verbatim delivery of the question text
- Chip labels listed in the prompt per-question
- "Something else" escape on open-ish questions (terminal answer, no follow-up)
- Reframe to avoid double negatives; positive answer is the natural one
- Split compound questions
- No text input inside ResponseCard
- Progress cues required at every marked point
- Acknowledgment variety required
- Registry-index-based progress (once BPH registry is in place, flip the page.jsx condition)

### Frontend work needed for BPH

Minimal, actually. The current code is written to work for any condition that has a registry. Steps:
1. Create `prompts/bph-question-registry.js`
2. Import it in `app/page.jsx` alongside the ED registry
3. Update `resolveEntry` / `detectQidFromText` / progress bar logic to pick the right registry based on `detectedCondition`
4. BPH prompt applies same marker + delivery rules

---

## 13. Deliverable for Next Iteration

When you prepare the BPH rebuild brief, give Claude web this document as context plus:

1. The current `prompts/bph.js` (so it can see the existing clinical content to preserve)
2. The current `prompts/ed.js` AND `prompts/ed-question-registry.js` (as the gold-standard reference)
3. This `REBUILD_LESSONS.md`
4. A request structured like:
   > "Generate `bph-question-registry.js` using the same schema and conventions as `ed-question-registry.js`. Then produce a targeted diff to `bph.js` applying the six prompt changes listed in REBUILD_LESSONS.md section 4. Every predefined question should have its chip labels and marker annotated inline. Preserve all clinical content — etiology logic, outcome criteria, safety gates, negative knowledge guards."

The deliverable you should expect back:
- `prompts/bph-question-registry.js` — complete
- A diff or new version of `prompts/bph.js` with the 6 prompt changes + per-question annotations
- A note on any BPH-specific deviations from the ED patterns (e.g., IPSS 0-5 scoring instead of SHIM 1-5)

---

## 14. Final Scoring — What "Done" Looks Like

A successful BPH rebuild should:

1. ✅ Every registry qid is referenced in the prompt (automated check: grep)
2. ✅ Every chip label in the registry appears verbatim in the prompt
3. ✅ `npm run build` compiles cleanly
4. ✅ Walking through a full consult in dev shows chips on every chip-based question
5. ✅ "Not sure" on a safety-gate question → either routes to Outcome C per registry OR re-presents with chips via the three-layer fallback
6. ✅ Patient can type free text at any point and AI handles it without going off-script
7. ✅ Progress bar moves monotonically across the full consult, hits ~98% on the last real question, 100% on the close message
8. ✅ BPH and ED consultations don't cross-contaminate (registries isolated by condition)

Ship it.
