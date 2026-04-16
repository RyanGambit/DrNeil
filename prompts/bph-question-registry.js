/**
 * BPH QUESTION REGISTRY — SINGLE SOURCE OF TRUTH
 *
 * Every question the patient sees lives here. The AI delivers these exactly
 * as written. The frontend reads chips and layout from here. Nothing is
 * improvised, nothing is guessed.
 *
 * Schema matches ed-question-registry.js exactly.
 * See REBUILD_LESSONS.md for conventions.
 *
 * BPH-SPECIFIC NOTES:
 * - IPSS uses layout: "scored" with 6 options (a-f) for Q1-6, different
 *   options for Q7 (nocturia), and 7 options (a-g) for Q8 (QoL)
 * - No CV screen (tamsulosin doesn't need cardiovascular clearance)
 * - Safety gate is 2 questions only (syncope/falls + cataract surgery)
 * - No medication choice — tamsulosin is the only virtual prescription
 * - Phenotype follow-up has branching: void volume → sleep apnea screening
 * - Intake includes caffeine/alcohol and evening fluids (unique to BPH)
 */

const BPH_QUESTION_REGISTRY = [

  // =========================================================================
  // PHASE 1: OPENING
  // =========================================================================

  {
    id: "opening-safety-screen",
    phase: 1,
    question: "Before we get started — any burning when you pee, any blood in your pee, any fevers, any bad pain in your back or side, or any time you couldn't pee at all?",
    chips: ["No, none of those", "Yes — one or more of these"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No, none of those": "continue",
      "Yes — one or more of these": "tiered_red_flag_routing"
    },
    notes: "AI delivers data acknowledgment + referral summary BEFORE this question. That intro is contextual (depends on referral data) so it's not in the registry. If Yes → AI must determine WHICH flag and route accordingly: can't pee → ER, severe pain → ER, fever → walk-in, blood → Outcome C."
  },

  {
    id: "opening-ready",
    phase: 1,
    question: "I'm going to take you through some questions about your symptoms. Some might seem detailed, but they help me understand exactly what's going on. Then we'll talk about what to do about it.\n\nReady to get started?",
    chips: ["Yes, let's go", "I have a question first"],
    layout: "horizontal",
    condition: null,
    progressCue: "Good — none of those worries.",
    routing: {
      "Yes, let's go": "continue",
      "I have a question first": "answer_then_reask"
    },
    notes: "If patient selects 'I have a question first', AI answers briefly then re-presents this question."
  },

  // =========================================================================
  // PHASE 2: INTAKE
  // =========================================================================

  {
    id: "intake-confirm",
    phase: 2,
    type: "confirm-panel",
    question: "I've reviewed your file. Here's what I have — let me know if anything needs updating:\n\nAge: {age}\nAllergies: {allergies}\nMedications: {medications}\nMedical history: {medical_history}\nSurgeries: {surgeries}\n\nDoes everything look right, or does anything need updating?",
    chips: ["All correct", "Something needs updating"],
    layout: "horizontal",
    condition: "referral_data_exists",
    progressCue: "First, a few quick background questions to make sure I have everything right.",
    routing: {
      "All correct": "continue",
      "Something needs updating": "follow_up_flagged_fields"
    },
    notes: "Stacked confirmation panel. This is the ONLY stacked section. If no referral data, fall back to asking individually."
  },

  {
    id: "intake-age",
    phase: 2,
    question: "How old are you?",
    chips: null,
    layout: null,
    condition: "no_referral_data",
    progressCue: "First, a few quick background questions to make sure I have everything right.",
    routing: null,
    notes: "Only asked if referral data doesn't include age. CRITICAL: Age must be 50-75 for virtual consultation."
  },
  {
    id: "intake-allergies",
    phase: 2,
    question: "Any allergies to medications I should know about?",
    chips: ["No allergies", "Yes"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "No allergies": "continue",
      "Yes": "follow_up_text"
    },
    notes: "If Yes, AI asks 'What are you allergic to?' as text follow-up."
  },
  {
    id: "intake-medications",
    phase: 2,
    question: "What medications are you currently taking?",
    chips: ["No medications", "Yes, I take some"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "No medications": "continue",
      "Yes, I take some": "follow_up_text"
    },
    notes: "If Yes, AI asks what they take. Listen for alpha-blockers, 5-ARIs, anticholinergics, blood pressure meds."
  },
  {
    id: "intake-medical-history",
    phase: 2,
    question: "Any major medical conditions — like diabetes, heart disease, high blood pressure?",
    chips: ["Nothing significant", "Yes"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "Nothing significant": "continue",
      "Yes": "follow_up_text"
    },
    notes: null
  },
  {
    id: "intake-surgeries",
    phase: 2,
    question: "Have you had any surgeries in the past?",
    chips: ["No surgeries", "Yes"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "No surgeries": "continue",
      "Yes": "follow_up_text"
    },
    notes: "Probe for prostate, pelvic, urological specifically."
  },

  {
    id: "intake-smoking",
    phase: 2,
    question: "Do you smoke, or have you ever smoked?",
    chips: ["Never", "I used to", "Yes, currently"],
    layout: "horizontal",
    condition: null,
    progressCue: "Thanks — just a few more quick ones.",
    routing: {
      "Never": "continue",
      "I used to": "ask_smoking_sub_questions_former",
      "Yes, currently": "ask_smoking_sub_questions_current"
    },
    notes: null
  },
  {
    id: "intake-smoking-amount",
    phase: 2,
    question: "About how much — a few cigarettes a day, half a pack, a pack, or more?",
    chips: ["A few cigarettes", "Half a pack", "About a pack", "More than a pack"],
    layout: "horizontal",
    condition: "smoking != Never",
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "intake-smoking-years",
    phase: 2,
    question: "And roughly how many years?",
    chips: ["Less than 5", "5–10 years", "10–20 years", "More than 20 years"],
    layout: "horizontal",
    condition: "smoking != Never",
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "intake-smoking-quit",
    phase: 2,
    question: "How long ago did you quit?",
    chips: ["Less than a year", "1–5 years", "5–10 years", "More than 10 years"],
    layout: "horizontal",
    condition: "smoking == I used to",
    progressCue: null,
    routing: null,
    notes: "Only asked for former smokers."
  },
  {
    id: "intake-caffeine-alcohol",
    phase: 2,
    question: "Do you drink much caffeine or alcohol?",
    chips: ["Not really", "Some caffeine", "Some alcohol", "Both"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: null,
    notes: "BPH-specific: caffeine and alcohol both affect urinary symptoms. Kept as one question per original prompt."
  },
  {
    id: "intake-evening-fluids",
    phase: 2,
    question: "Do you usually have anything to drink in the evening after dinner?",
    chips: ["Not usually", "A bit of water", "Yes, quite a bit", "Tea or coffee in the evening"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: null,
    notes: "BPH-specific: evening fluids directly relate to nocturia. Important for phenotyping."
  },

  // =========================================================================
  // PHASE 3: IPSS QUESTIONNAIRE (7 Questions + QoL)
  // =========================================================================

  {
    id: "ipss-q1-emptying",
    phase: 3,
    question: "How often have you had the sensation of not emptying your bladder?\n\na) Not at all\nb) Less than 1 in 5 times\nc) Less than half the time\nd) About half the time\ne) More than half the time\nf) Almost always",
    chips: ["a) Not at all", "b) Less than 1 in 5 times", "c) Less than half the time", "d) About half the time", "e) More than half the time", "f) Almost always"],
    layout: "scored",
    condition: null,
    progressCue: "Now I'm going to ask you about your urinary symptoms over the past month. Just answer as best you can — there's no right or wrong.\n\nThere are 8 questions — won't take long.",
    routing: null,
    notes: "IPSS scoring is INTERNAL. Never show scores to patient. Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Obstructive marker."
  },
  {
    id: "ipss-q2-frequency",
    phase: 3,
    question: "How often have you had to urinate less than every two hours?\n\na) Not at all\nb) Less than 1 in 5 times\nc) Less than half the time\nd) About half the time\ne) More than half the time\nf) Almost always",
    chips: ["a) Not at all", "b) Less than 1 in 5 times", "c) Less than half the time", "d) About half the time", "e) More than half the time", "f) Almost always"],
    layout: "scored",
    condition: null,
    progressCue: null,
    routing: null,
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Storage marker."
  },
  {
    id: "ipss-q3-intermittency",
    phase: 3,
    question: "How often have you found you stopped and started again several times when you urinated?\n\na) Not at all\nb) Less than 1 in 5 times\nc) Less than half the time\nd) About half the time\ne) More than half the time\nf) Almost always",
    chips: ["a) Not at all", "b) Less than 1 in 5 times", "c) Less than half the time", "d) About half the time", "e) More than half the time", "f) Almost always"],
    layout: "scored",
    condition: null,
    progressCue: "Good — keep going.",
    routing: null,
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Obstructive marker."
  },
  {
    id: "ipss-q4-urgency",
    phase: 3,
    question: "How often have you found it difficult to postpone urination?\n\na) Not at all\nb) Less than 1 in 5 times\nc) Less than half the time\nd) About half the time\ne) More than half the time\nf) Almost always",
    chips: ["a) Not at all", "b) Less than 1 in 5 times", "c) Less than half the time", "d) About half the time", "e) More than half the time", "f) Almost always"],
    layout: "scored",
    condition: null,
    progressCue: null,
    routing: null,
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Storage marker. Q4 ≥4 + leakage → storage-dominant → Outcome C."
  },
  {
    id: "ipss-q5-weak-stream",
    phase: 3,
    question: "How often have you had a weak urinary stream?\n\na) Not at all\nb) Less than 1 in 5 times\nc) Less than half the time\nd) About half the time\ne) More than half the time\nf) Almost always",
    chips: ["a) Not at all", "b) Less than 1 in 5 times", "c) Less than half the time", "d) About half the time", "e) More than half the time", "f) Almost always"],
    layout: "scored",
    condition: null,
    progressCue: "Past the halfway mark.",
    routing: null,
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Obstructive marker."
  },
  {
    id: "ipss-q6-straining",
    phase: 3,
    question: "How often have you had to strain to start urination?\n\na) Not at all\nb) Less than 1 in 5 times\nc) Less than half the time\nd) About half the time\ne) More than half the time\nf) Almost always",
    chips: ["a) Not at all", "b) Less than 1 in 5 times", "c) Less than half the time", "d) About half the time", "e) More than half the time", "f) Almost always"],
    layout: "scored",
    condition: null,
    progressCue: null,
    routing: null,
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Obstructive marker."
  },
  {
    id: "ipss-q7-nocturia",
    phase: 3,
    question: "How many times do you typically get up at night to urinate?\n\na) None\nb) 1 time\nc) 2 times\nd) 3 times\ne) 4 times\nf) 5 or more times",
    chips: ["a) None", "b) 1 time", "c) 2 times", "d) 3 times", "e) 4 times", "f) 5 or more times"],
    layout: "scored",
    condition: null,
    progressCue: "Almost done.",
    routing: {
      "f) 5 or more times": "nocturia_5_plus_outcome_c"
    },
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5. Nocturia ≥5 → Outcome C regardless of other scores."
  },
  {
    id: "ipss-q8-qol",
    phase: 3,
    question: "If you were to spend the rest of your life with your urinary condition just the way it is now, how would you feel about that?\n\na) Delighted\nb) Pleased\nc) Mostly satisfied\nd) Mixed\ne) Mostly dissatisfied\nf) Unhappy\ng) Terrible",
    chips: ["a) Delighted", "b) Pleased", "c) Mostly satisfied", "d) Mixed", "e) Mostly dissatisfied", "f) Unhappy", "g) Terrible"],
    layout: "scored",
    condition: null,
    progressCue: "Last one.",
    routing: null,
    notes: "Scoring: a=0, b=1, c=2, d=3, e=4, f=5, g=6. QoL ≤3 → Outcome A (watchful waiting). QoL >3 + IPSS >15 → Outcome B eligible."
  },

  // =========================================================================
  // PHASE 4: PHENOTYPE FOLLOW-UP (After IPSS)
  // =========================================================================

  {
    id: "followup-void-volume",
    phase: 4,
    question: "When you get up at night, do you pee a regular amount each time, or just a small amount?",
    chips: ["Regular amount each time", "Just a small amount", "It varies"],
    layout: "horizontal",
    condition: "nocturia >= 1",
    progressCue: "Thanks for answering all of those. Just a few more questions to round out the picture, and then we'll make a plan.",
    routing: {
      "Regular amount each time": "nocturnal_polyuria_ask_apnea",
      "Just a small amount": "continue",
      "It varies": "continue"
    },
    notes: "KEY PHENOTYPE QUESTION. Regular/full voids → nocturnal polyuria → sleep apnea screening → Outcome C. Small voids → continue with remaining follow-ups."
  },

  {
    id: "followup-snoring",
    phase: 4,
    question: "Do you snore, or has anyone noticed you stop breathing while you sleep?",
    chips: ["No", "Yes", "Not sure"],
    layout: "horizontal",
    condition: "void_volume == regular",
    progressCue: null,
    routing: null,
    notes: "Triage flag for in-person visit. Document in SOAP note."
  },
  {
    id: "followup-daytime-tired",
    phase: 4,
    question: "Do you often feel tired during the day even after a full night's sleep?",
    chips: ["No, I feel rested", "Yes, often tired", "Sometimes"],
    layout: "horizontal",
    condition: "void_volume == regular",
    progressCue: null,
    routing: null,
    notes: "Triage flag for in-person visit. After this → early exit to Outcome C. Skip remaining follow-up questions."
  },

  {
    id: "followup-leakage",
    phase: 4,
    question: "Do you ever leak if you can't make it to the bathroom in time?",
    chips: ["No, never", "Occasionally", "Yes, regularly"],
    layout: "horizontal",
    condition: "not_early_exit",
    progressCue: null,
    routing: {
      "No, never": "continue",
      "Occasionally": "note_storage_signal",
      "Yes, regularly": "storage_severity_flag"
    },
    notes: "If Yes/regularly + high urgency score (Q4 ≥4) → storage-dominant → Outcome C."
  },
  {
    id: "followup-bother",
    phase: 4,
    question: "What bothers you the most about all this?",
    chips: ["The nighttime trips", "The urgency and rushing", "The weak stream", "It's affecting my daily life", "Something else"],
    layout: "horizontal",
    condition: "not_early_exit",
    progressCue: null,
    routing: {
      "The nighttime trips": "continue",
      "The urgency and rushing": "continue",
      "The weak stream": "continue",
      "It's affecting my daily life": "continue",
      "Something else": "continue"
    },
    notes: "Discordance check: does their bother match their IPSS pattern? All chip answers including 'Something else' are terminal — record and continue."
  },
  {
    id: "followup-duration",
    phase: 4,
    question: "How long has this been going on?",
    chips: ["A few weeks", "A few months", "About a year", "Several years"],
    layout: "horizontal",
    condition: "not_early_exit",
    progressCue: null,
    routing: null,
    notes: "Establishes timeline."
  },
  {
    id: "followup-trajectory",
    phase: 4,
    question: "And is it getting worse, staying the same, or getting better?",
    chips: ["Getting worse", "Staying about the same", "Getting better"],
    layout: "horizontal",
    condition: "not_early_exit",
    progressCue: null,
    routing: null,
    notes: "Progression context."
  },

  // =========================================================================
  // PHASE 5: OUTCOME DETERMINATION QUESTIONS
  // =========================================================================

  {
    id: "outcome-confirm-a",
    phase: 5,
    question: "It sounds like this is manageable for you right now. If things stayed exactly like this for the next few years, would that be okay?",
    chips: ["Yes, I can manage", "Actually, I'd want it to be better"],
    layout: "horizontal",
    condition: "ipss_lte_15 OR qol_lte_3",
    progressCue: null,
    routing: {
      "Yes, I can manage": "deliver_outcome_a",
      "Actually, I'd want it to be better": "explore_discordance"
    },
    notes: "Outcome A confirmation. If they say they'd want better → explore discordance per prompt rules."
  },
  {
    id: "outcome-confirm-b",
    phase: 5,
    question: "If things stayed exactly like this for the next few years, would that be okay, or would you want it to be better?",
    chips: ["I can live with it", "I'd want it to be better"],
    layout: "horizontal",
    condition: "ipss_gt_15 AND qol_gt_3",
    progressCue: null,
    routing: {
      "I can live with it": "deliver_outcome_a",
      "I'd want it to be better": "ask_medication_willingness"
    },
    notes: "Outcome B eligibility confirmation. 'I can live with it' → Outcome A regardless of scores."
  },
  {
    id: "outcome-medication-willingness",
    phase: 5,
    question: null,
    chips: ["Yes, worth trying", "No, I'd rather not"],
    layout: "horizontal",
    condition: "wants_improvement",
    progressCue: null,
    routing: {
      "Yes, worth trying": "proceed_to_safety_gate",
      "No, I'd rather not": "deliver_outcome_a"
    },
    notes: "AI delivers contextually: 'If a daily pill could help with [their main complaint] — but might cause some mild side effects like dizziness or changes during sex — would that be worth trying?' Question text varies based on patient's complaint, so question field is null. Marker still required."
  },

  // =========================================================================
  // PHASE 6: SAFETY GATE (only if heading toward Outcome B)
  // =========================================================================

  {
    id: "sg-q1-syncope",
    phase: 6,
    question: "Have you ever fainted, or had a fall because of dizziness or lightheadedness?",
    chips: ["No, never", "Yes"],
    layout: "horizontal",
    condition: "heading_toward_outcome_b",
    progressCue: "Almost there — just two safety checks.",
    routing: {
      "No, never": "continue",
      "Yes": "outcome_c_syncope"
    },
    notes: "History of syncope or falls from dizziness → Outcome C. Tamsulosin can worsen orthostatic hypotension."
  },
  {
    id: "sg-q2-cataract",
    phase: 6,
    question: "Are you having any eye surgery planned — like cataract surgery?",
    chips: ["No, nothing planned", "Yes, within the next 6 months", "Yes, but more than 6 months away"],
    layout: "horizontal",
    condition: "heading_toward_outcome_b",
    progressCue: null,
    routing: {
      "No, nothing planned": "all_gates_passed",
      "Yes, within the next 6 months": "outcome_c_cataract",
      "Yes, but more than 6 months away": "proceed_with_ophthalmologist_note"
    },
    notes: "Cataract within 6 months → Outcome C, do NOT prescribe. >6 months → may proceed but document and advise patient to inform ophthalmologist. Tamsulosin causes intraoperative floppy iris syndrome."
  },

  // =========================================================================
  // PHASE 7: OUTCOME B DELIVERY (Drip-Feed)
  // =========================================================================

  {
    id: "outcome-b-ack-1",
    phase: 7,
    question: null,
    chips: ["Got it", "I have a question"],
    layout: "horizontal",
    condition: "outcome_b_eligible",
    progressCue: null,
    routing: {
      "Got it": "continue_to_message_2",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 1 (the medication — tamsulosin 0.4mg, bedtime, how it works). AI waits for acknowledgment."
  },
  {
    id: "outcome-b-ack-2",
    phase: 7,
    question: null,
    chips: ["Makes sense", "I have a question"],
    layout: "horizontal",
    condition: "outcome_b_message_1_acknowledged",
    progressCue: null,
    routing: {
      "Makes sense": "continue_to_message_3",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 2 (side effects — lightheadedness, reduced ejaculate, reversible). AI waits for acknowledgment."
  },

];

export default BPH_QUESTION_REGISTRY;
