/**
 * ED QUESTION REGISTRY — SINGLE SOURCE OF TRUTH
 *
 * Every question the patient sees lives here. The AI delivers these exactly
 * as written. The frontend reads chips and layout from here. Nothing is
 * improvised, nothing is guessed.
 *
 * STRUCTURE:
 * - id: unique identifier
 * - phase: which phase of the consultation
 * - question: exact text the AI must deliver (may include intro/transition text)
 * - chips: array of clickable response options (null = open text response expected)
 * - layout: "horizontal" (default) | "scored" (vertical with letter badges)
 * - condition: when to ask this question (null = always ask)
 * - progressCue: text to prepend to this question's message (null = none)
 * - routing: what each answer means clinically (for AI internal use, not displayed)
 * - notes: implementation notes
 */

const ED_QUESTION_REGISTRY = [

  // =========================================================================
  // PHASE 1: OPENING
  // =========================================================================

  {
    id: "opening-safety-screen",
    phase: 1,
    question: "Before we get started — have you had any chest pain during or after sex, any erection that wouldn't go down for hours, or any injury to the penis?",
    chips: ["No, none of those", "Yes — one or more of these"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No, none of those": "continue",
      "Yes — one or more of these": "urgent_escalation"
    },
    notes: "AI delivers normalization + referral summary BEFORE this question. That intro is contextual (depends on referral data) so it's not in the registry. But this question is always asked exactly as written."
  },

  {
    id: "opening-ready",
    phase: 1,
    question: "I'm going to ask you some questions about what's been going on. Some might feel personal, but they help me understand the full picture. There are no wrong answers.\n\nReady to get started?",
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
    progressCue: "First, a few quick background questions — about ten of them, then we'll move on to the important stuff.",
    routing: {
      "All correct": "continue",
      "Something needs updating": "follow_up_flagged_fields"
    },
    notes: "Stacked confirmation panel. This is the ONLY stacked section in the entire consultation. If no referral data, fall back to asking Q1-Q5 individually (see intake-age through intake-surgeries)."
  },

  {
    id: "intake-age",
    phase: 2,
    question: "How old are you?",
    chips: null,
    layout: null,
    condition: "no_referral_data",
    progressCue: "First, a few quick background questions — about ten of them, then we'll move on to the important stuff.",
    routing: null,
    notes: "Only asked if referral data doesn't include age."
  },
  {
    id: "intake-allergies",
    phase: 2,
    question: "Do you have any allergies — to medications or anything else?",
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
    question: "Are you currently taking any medications?",
    chips: ["No medications", "Yes"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "No medications": "continue",
      "Yes": "follow_up_text_listen_for_nitrates"
    },
    notes: "CRITICAL: If nitrates discovered → Outcome C immediately. Also flag alpha-blockers, SSRIs, finasteride."
  },
  {
    id: "intake-medical-history",
    phase: 2,
    question: "Any medical conditions I should know about — like diabetes, heart disease, high blood pressure, or high cholesterol?",
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
    question: "Have you had any surgeries — especially anything involving the prostate, pelvis, or penis?",
    chips: ["No surgeries", "Yes"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "No surgeries": "continue",
      "Yes": "follow_up_text"
    },
    notes: "Probe for prostate, pelvic, penile specifically. Post-surgical → likely Outcome C."
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
    id: "intake-alcohol",
    phase: 2,
    question: "How much alcohol do you drink in a typical week?",
    chips: ["None", "A few drinks", "Most days", "Daily or heavy"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "intake-cannabis",
    phase: 2,
    question: "Do you use cannabis at all?",
    chips: ["No", "Occasionally", "Regularly"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "intake-exercise",
    phase: 2,
    question: "How active are you — do you get regular exercise?",
    chips: ["Not really", "Some, but not regular", "Yes, a few times a week", "Very active"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "intake-relationship",
    phase: 2,
    question: "Are you currently in a relationship?",
    chips: ["Yes", "No", "It's complicated"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "Yes": "flag_for_partner_question_later",
      "No": "continue",
      "It's complicated": "continue"
    },
    notes: "If Yes, partner question is asked later (after Phase 4 clinical questions)."
  },

  // =========================================================================
  // PHASE 3: SHIM QUESTIONNAIRE
  // =========================================================================

  {
    id: "shim-q1-confidence",
    phase: 3,
    question: "How would you rate your confidence that you could get and keep an erection?\n\na) Very low\nb) Low\nc) Moderate\nd) High\ne) Very high",
    chips: ["a) Very low", "b) Low", "c) Moderate", "d) High", "e) Very high"],
    layout: "scored",
    condition: null,
    progressCue: "Before we get into the details, I want to ask five quick questions about how things have been working. These give me a baseline so when we follow up, I can measure whether things are improving.\n\nThere are five questions — won't take long.",
    routing: null,
    notes: "SHIM scoring is INTERNAL. Never show scores to patient."
  },
  {
    id: "shim-activity-gate",
    phase: 3,
    question: "Have you been sexually active in the past 6 months — either with a partner or on your own?",
    chips: ["Yes", "No"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "Yes": "continue_shim",
      "No": "skip_shim_q2_q5_ask_why"
    },
    notes: "If No: score Q2-5 as 0 each. Ask why (no partner, avoidance, no interest, medical). Then skip to Phase 4."
  },
  {
    id: "shim-q2-firmness",
    phase: 3,
    question: "When you were turned on or stimulated, how often were your erections hard enough for sex?\n\na) Almost never\nb) Less than half the time\nc) About half the time\nd) More than half the time\ne) Almost always",
    chips: ["a) Almost never", "b) Less than half the time", "c) About half the time", "d) More than half the time", "e) Almost always"],
    layout: "scored",
    condition: "sexually_active == Yes",
    progressCue: "Good — four more questions.",
    routing: null,
    notes: null
  },
  {
    id: "shim-q3-maintenance",
    phase: 3,
    question: "During sex, how often were you able to keep your erection after you got going?\n\na) Almost never\nb) Less than half the time\nc) About half the time\nd) More than half the time\ne) Almost always",
    chips: ["a) Almost never", "b) Less than half the time", "c) About half the time", "d) More than half the time", "e) Almost always"],
    layout: "scored",
    condition: "sexually_active == Yes",
    progressCue: "Good — three more.",
    routing: null,
    notes: null
  },
  {
    id: "shim-q4-difficulty",
    phase: 3,
    question: "During sex, how hard was it to keep your erection all the way to the end?\n\na) Extremely hard\nb) Very hard\nc) Hard\nd) A little hard\ne) Not hard at all",
    chips: ["a) Extremely hard", "b) Very hard", "c) Hard", "d) A little hard", "e) Not hard at all"],
    layout: "scored",
    condition: "sexually_active == Yes",
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "shim-q5-satisfaction",
    phase: 3,
    question: "When you tried to have sex, how often was it satisfying for you?\n\na) Almost never\nb) Less than half the time\nc) About half the time\nd) More than half the time\ne) Almost always",
    chips: ["a) Almost never", "b) Less than half the time", "c) About half the time", "d) More than half the time", "e) Almost always"],
    layout: "scored",
    condition: "sexually_active == Yes",
    progressCue: "Almost done — last one.",
    routing: null,
    notes: null
  },

  // =========================================================================
  // PHASE 4: CLINICAL HISTORY (The Diagnostic Engine)
  // =========================================================================

  {
    id: "clinical-q1-morning",
    phase: 4,
    question: "Do you still get morning erections — even partial ones?",
    chips: ["Yes, regularly", "Sometimes, but weaker", "Rarely or never"],
    layout: "horizontal",
    condition: null,
    progressCue: "Thanks for those — that gives me a good baseline. Now I'm going to ask some questions about what's actually going on. These are the ones that help me figure out the best approach for you. About 8 questions, and some will feel pretty personal — but they matter.",
    routing: {
      "Yes, regularly": "psychogenic_signal",
      "Sometimes, but weaker": "mixed_signal",
      "Rarely or never": "organic_signal"
    },
    notes: null
  },
  {
    id: "clinical-q2-solo",
    phase: 4,
    question: "When you're on your own, can you get and keep an erection well enough to finish?",
    chips: ["Yes, works fine alone", "Somewhat, but not great", "No, same issue alone"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "Yes, works fine alone": "psychogenic_signal",
      "Somewhat, but not great": "mixed_signal",
      "No, same issue alone": "organic_signal"
    },
    notes: null
  },
  {
    id: "clinical-q3-situational",
    phase: 4,
    question: "Does it happen every time, or only in certain situations — like works sometimes but not others?",
    chips: ["Every time, no matter what", "Depends on the situation", "Mostly every time with some exceptions"],
    layout: "horizontal",
    condition: null,
    progressCue: "Good — those two tell me a lot. Six more.",
    routing: {
      "Every time, no matter what": "organic_signal",
      "Depends on the situation": "psychogenic_signal",
      "Mostly every time with some exceptions": "mixed_signal"
    },
    notes: null
  },
  {
    id: "clinical-q4-onset",
    phase: 4,
    question: "Did this come on gradually over time, or was it more sudden?",
    chips: ["Gradually, over months or years", "Fairly sudden", "Hard to say"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "Gradually, over months or years": "organic_signal",
      "Fairly sudden": "psychogenic_or_medication_signal",
      "Hard to say": "record_uncertain"
    },
    notes: null
  },
  {
    id: "clinical-q5-type",
    phase: 4,
    question: "Is the main issue getting hard in the first place, or getting hard but then losing it?",
    chips: ["Trouble getting hard", "Get hard but lose it", "Both"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: null,
    notes: null
  },
  {
    id: "clinical-q6-stress",
    phase: 4,
    question: "Has there been a lot of stress, anxiety, or relationship tension that might be playing into this?",
    chips: ["Not really", "Some, but not major", "Yes, significant stress"],
    layout: "horizontal",
    condition: null,
    progressCue: "Thanks — past the halfway mark. Three more.",
    routing: {
      "Not really": "less_likely_psychogenic",
      "Some, but not major": "mixed_signal",
      "Yes, significant stress": "psychogenic_signal"
    },
    notes: null
  },
  {
    id: "clinical-q7-prior-treatment",
    phase: 4,
    question: "Have you ever tried any pills or treatments for erections before?",
    chips: ["No, never tried anything", "Yes, I've tried something"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No, never tried anything": "first_line_eligible",
      "Yes, I've tried something": "ask_prior_treatment_sub_questions"
    },
    notes: "MOST IMPORTANT TRIAGE VARIABLE. If Yes, must determine adequacy via sub-questions."
  },

  {
    id: "clinical-q7a-which-pill",
    phase: 4,
    question: "Which pill did you try — and the dose, if you remember?",
    chips: null,
    layout: null,
    condition: "prior_treatment == Yes",
    progressCue: null,
    routing: null,
    notes: "If they don't know the dose → assume inadequate trial."
  },
  {
    id: "clinical-q7b-how-many",
    phase: 4,
    question: "How many times did you try it?",
    chips: ["Just once or twice", "3–5 times", "6 or more times"],
    layout: "horizontal",
    condition: "prior_treatment == Yes",
    progressCue: null,
    routing: {
      "Just once or twice": "inadequate_trial_signal",
      "3–5 times": "borderline",
      "6 or more times": "adequate_trial_signal"
    },
    notes: "Fewer than 4 attempts = inadequate trial."
  },
  {
    id: "clinical-q7c-food",
    phase: 4,
    question: "Did you take it on an empty stomach or after a big meal?",
    chips: ["Empty or light stomach", "After a meal", "Don't remember"],
    layout: "horizontal",
    condition: "prior_treatment == Yes AND medication is sildenafil",
    progressCue: null,
    routing: {
      "After a meal": "inadequate_trial_signal"
    },
    notes: "Only relevant for sildenafil. Heavy fatty meal delays absorption."
  },
  {
    id: "clinical-q7d-timing",
    phase: 4,
    question: "How long before sex did you take it?",
    chips: ["Less than 15 minutes", "About 30–60 minutes", "More than an hour", "Don't remember"],
    layout: "horizontal",
    condition: "prior_treatment == Yes",
    progressCue: null,
    routing: {
      "Less than 15 minutes": "inadequate_trial_signal"
    },
    notes: "Sildenafil: 30-60 min optimal. Tadalafil PRN: ~2 hours."
  },
  {
    id: "clinical-q7e-arousal",
    phase: 4,
    question: "Were you sexually stimulated after taking it?",
    chips: ["Yes", "No, I just took it and waited", "Don't remember"],
    layout: "horizontal",
    condition: "prior_treatment == Yes",
    progressCue: null,
    routing: {
      "No, I just took it and waited": "inadequate_trial_signal"
    },
    notes: "PDE5i requires arousal. It doesn't cause spontaneous erections."
  },
  {
    id: "clinical-q7f-why-stopped",
    phase: 4,
    question: "What made you decide it wasn't working?",
    chips: ["Didn't work at all", "Helped some, not enough", "Side effects", "Something else"],
    layout: "horizontal",
    condition: "prior_treatment == Yes",
    progressCue: null,
    routing: {
      "Didn't work at all": "continue",
      "Helped some, not enough": "continue",
      "Side effects": "continue",
      "Something else": "continue"
    },
    notes: "Listen for: unrealistic expectations, gave up too soon, side effects, genuinely didn't work. All chip answers are valid — record and continue."
  },

  {
    id: "clinical-q8-bother",
    phase: 4,
    question: "What bothers you the most about all of this?",
    chips: ["Affecting my relationship", "Less confident in myself", "Worried something's wrong", "Just want to feel normal again", "Something else"],
    layout: "horizontal",
    condition: null,
    progressCue: "Almost done — one more.",
    routing: {
      "Affecting my relationship": "continue",
      "Less confident in myself": "continue",
      "Worried something's wrong": "continue",
      "Just want to feel normal again": "continue",
      "Something else": "continue"
    },
    notes: "Check for discordance: mild SHIM but very distressed, or severe SHIM but 'it's fine'. All chip answers (including 'Something else') are valid — record and continue. If patient types their own answer in the main input instead, accept it as-is."
  },

  // =========================================================================
  // PARTNER QUESTION (conditional — after Phase 4, before CV screen)
  // =========================================================================

  {
    id: "partner-handling",
    phase: 4,
    question: "How is your partner handling this?",
    chips: ["They're supportive", "It's causing some tension", "We don't really talk about it", "They don't know yet", "Something else"],
    layout: "horizontal",
    condition: "relationship_status == Yes",
    progressCue: "That's it for the questions. You did great — I have a clear picture now.",
    routing: {
      "They're supportive": "continue",
      "It's causing some tension": "note_for_outcome_c_consideration",
      "We don't really talk about it": "continue",
      "They don't know yet": "continue",
      "Something else": "continue"
    },
    notes: "NEVER use gendered pronouns for partner. Always they/them. Do NOT probe deeply into relationship dynamics. All chip answers (including 'Something else') are valid — record and continue. Significant tension is noted in SOAP but does not block Outcome B."
  },

  // =========================================================================
  // CONDITIONAL FOLLOW-UPS (only if triggered by Phase 4 answers)
  // =========================================================================

  {
    id: "conditional-desire",
    phase: 4,
    question: "Is your interest in sex still there, or has that dropped off too?",
    chips: ["Interest is still there", "It's dropped off", "Not sure"],
    layout: "horizontal",
    condition: "low_desire_mentioned",
    progressCue: null,
    routing: {
      "It's dropped off": "ask_fatigue_mood",
      "Interest is still there": "continue",
      "Not sure": "continue"
    },
    notes: "Triggers further: 'Are you also noticing more fatigue, low energy, or mood changes?'"
  },
  {
    id: "conditional-fatigue-mood",
    phase: 4,
    question: "Are you also noticing more fatigue, low energy, or mood changes?",
    chips: ["Yes, several of those", "Maybe a bit", "No, energy is fine"],
    layout: "horizontal",
    condition: "desire_dropped",
    progressCue: null,
    routing: {
      "Yes, several of those": "suspect_testosterone_deficiency",
      "Maybe a bit": "possible_testosterone",
      "No, energy is fine": "likely_reactive_to_ed"
    },
    notes: "If testosterone suspected → Outcome D (test) or C."
  },
  {
    id: "conditional-medication-timing",
    phase: 4,
    question: "Did this start around the time you began a new medication?",
    chips: ["Yes, around that time", "No, not related", "Not sure"],
    layout: "horizontal",
    condition: "sudden_onset AND on_medications",
    progressCue: null,
    routing: {
      "Yes, around that time": "flag_medication_for_pcp"
    },
    notes: "Flag medication, can bridge with PDE5i."
  },
  {
    id: "conditional-curvature",
    phase: 4,
    question: "Have you noticed any bend or curve in the penis that's new?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: "curvature_mentioned",
    progressCue: null,
    routing: {
      "Yes": "outcome_c_peyronies"
    },
    notes: "Cannot assess virtually → Outcome C."
  },

  // =========================================================================
  // CV RISK SCREEN (one at a time — only if heading toward Outcome B)
  // =========================================================================

  {
    id: "cv-q1-stairs",
    phase: 5,
    question: "Can you walk up two flights of stairs without chest pain or getting really short of breath?",
    chips: ["Yes, no problem", "No, I struggle with that", "Not sure"],
    layout: "horizontal",
    condition: "heading_toward_outcome_b",
    progressCue: "Just a few safety questions before we talk about treatment.",
    routing: {
      "Yes, no problem": "continue",
      "No, I struggle with that": "outcome_c_cv_risk",
      "Not sure": "outcome_c_cv_risk"
    },
    notes: null
  },
  {
    id: "cv-q2-heart-history",
    phase: 5,
    question: "Have you had a heart attack, stroke, or any heart procedure in the past 6 months?",
    chips: ["No, nothing like that", "Yes"],
    layout: "horizontal",
    condition: "heading_toward_outcome_b",
    progressCue: null,
    routing: {
      "No, nothing like that": "continue",
      "Yes": "outcome_c_cv_risk"
    },
    notes: null
  },
  {
    id: "cv-q3-blood-pressure",
    phase: 5,
    question: "Is your blood pressure well controlled right now?",
    chips: ["Yes, it's controlled", "No, it's been an issue", "Not sure"],
    layout: "horizontal",
    condition: "heading_toward_outcome_b",
    progressCue: null,
    routing: {
      "Yes, it's controlled": "continue",
      "No, it's been an issue": "outcome_c_cv_risk",
      "Not sure": "outcome_c_cv_risk"
    },
    notes: null
  },

  // =========================================================================
  // SAFETY GATE (one at a time — only if all CV questions passed)
  // =========================================================================

  {
    id: "sg-q1-nitrates",
    phase: 6,
    question: "Do you take any nitroglycerin, heart spray, or nitrate medication?",
    chips: ["No, I don't", "Yes, I do"],
    layout: "horizontal",
    condition: "cv_screen_passed",
    progressCue: "Good — that clears the safety side. Five final checks before we get your prescription sorted.",
    routing: {
      "No, I don't": "continue",
      "Yes, I do": "absolute_stop_outcome_c"
    },
    notes: "ABSOLUTE STOP. Even if asked before — confirm here."
  },
  {
    id: "sg-q2-cv-fitness",
    phase: 6,
    question: "And you confirmed you can climb stairs without chest pain or severe shortness of breath — is that right?",
    chips: ["Yes, that's right", "Actually, I'm not sure about that"],
    layout: "horizontal",
    condition: "cv_screen_passed",
    progressCue: null,
    routing: {
      "Yes, that's right": "continue",
      "Actually, I'm not sure about that": "outcome_c_cv_risk"
    },
    notes: "Confirmation of CV screen. Not a new question."
  },
  {
    id: "sg-q3-alpha-blocker",
    phase: 6,
    question: "Are you taking tamsulosin or any pill for prostate or urinary symptoms?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: "cv_screen_passed",
    progressCue: null,
    routing: {
      "No": "continue",
      "Yes": "continue_with_timing_note"
    },
    notes: "Yes does NOT stop the process. It just means timing adjustment is needed. Document it."
  },
  {
    id: "sg-q4-priapism",
    phase: 6,
    question: "Have you ever had an erection that wouldn't go down for hours?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: "cv_screen_passed",
    progressCue: "Almost there.",
    routing: {
      "No": "continue",
      "Yes": "outcome_c_priapism"
    },
    notes: null
  },
  {
    id: "sg-q5-sickle-cell",
    phase: 6,
    question: "Do you have sickle cell disease?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: "cv_screen_passed",
    progressCue: null,
    routing: {
      "No": "all_gates_passed",
      "Yes": "outcome_c_priapism"
    },
    notes: null
  },

  // =========================================================================
  // OUTCOME B: MEDICATION CHOICE
  // =========================================================================

  {
    id: "outcome-b-choice",
    phase: 7,
    question: "There are two ways to take this kind of pill:\n\nOption 1: You take it about an hour before sex. It works that night and wears off by the next day. Good if you don't have sex every day and want it on demand.\n\nOption 2: A small pill every day — like a vitamin. It's always in your system so you don't have to plan ahead. Good if you prefer spontaneity or if you also have urinary symptoms.\n\nBoth work equally well. Which sounds better for you?",
    chips: ["Option 1 — before sex", "Option 2 — daily pill"],
    layout: "horizontal",
    condition: "outcome_b_eligible",
    progressCue: null,
    routing: {
      "Option 1 — before sex": "prescribe_sildenafil",
      "Option 2 — daily pill": "prescribe_tadalafil"
    },
    notes: "CUA says no preference for daily vs PRN. Let patient choose. Do NOT explain one in full before asking."
  },

  {
    id: "outcome-b-ack-1",
    phase: 7,
    question: null,
    chips: ["Got it", "I have a question"],
    layout: "horizontal",
    condition: "outcome_b_medication_chosen",
    progressCue: null,
    routing: {
      "Got it": "continue_to_message_2",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 1 (the medication). AI waits for acknowledgment."
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
    notes: "After Message 2 (what to expect). AI waits for acknowledgment."
  },

];

export default ED_QUESTION_REGISTRY;
