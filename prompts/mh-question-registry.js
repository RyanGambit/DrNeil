/**
 * MH QUESTION REGISTRY — SINGLE SOURCE OF TRUTH
 *
 * Every question the patient sees lives here. The AI delivers these exactly
 * as written. The frontend reads chips and layout from here. Nothing is
 * improvised, nothing is guessed.
 *
 * Schema matches ed-question-registry.js and bph-question-registry.js exactly.
 * See REBUILD_LESSONS.md for conventions.
 *
 * MH-SPECIFIC NOTES:
 * - No scored questionnaire (no IPSS/SHIM equivalent)
 * - Risk factors are mostly Yes/No questions — simple horizontal chips
 * - Three paths: Path 1 (repeat UA), Path 2 (scope+US+cytology),
 *   Path 3 (scope+US+cytology+CT)
 * - No medication choice — this is a test-ordering tool
 * - No safety gate before outcome — the risk factors ARE the gate
 * - Simplified per clinical team feedback: any risk factor = Path 2,
 *   Lynch/cyclophosphamide/gross hematuria = Path 3
 * - Smoking sub-questions follow same pattern as ED/BPH
 * - Some questions conditional on sex (menstrual, pregnancy)
 *
 * FINGERPRINTS: every contextual entry (question: null) carries a
 * fingerprints[] array of distinctive phrases for the text-match fallback
 * layer. See REBUILD_LESSONS.md + the contextual-fallback commit history
 * for rationale — without fingerprints, ack messages have no recovery
 * if the AI drops the marker.
 */

const MH_QUESTION_REGISTRY = [

  // =========================================================================
  // PHASE 1: OPENING
  // =========================================================================

  {
    id: "opening-safety-screen",
    phase: 1,
    question: "Before we get started — have you seen blood in your pee that you could actually see, any fever or chills, any bad pain in your side or back, or any time you couldn't pee at all?",
    chips: ["No, none of those", "Yes — one or more of these"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No, none of those": "continue",
      "Yes — one or more of these": "tiered_emergency_routing"
    },
    notes: "AI delivers normalization + referral summary BEFORE this question. If Yes → AI must determine WHICH flag: visible blood → note for Path 3 + assess if acute, fever → walk-in, severe pain → ER, can't pee → ER. Visible blood alone doesn't trigger emergency — it triggers Path 3 but consult continues."
  },

  {
    id: "opening-ready",
    phase: 1,
    question: "I'm going to ask you some questions about your background and health history. This helps me figure out how carefully we need to look into this. Most of the questions are quick.\n\nReady to get started?",
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
    question: "I've reviewed your file. Here's what I have — let me know if anything needs updating:\n\nAge: {age}\nSex: {sex}\nAllergies: {allergies}\nMedications: {medications}\nMedical history: {medical_history}\nSurgeries: {surgeries}\n\nDoes everything look right, or does anything need updating?",
    chips: ["All correct", "Something needs updating"],
    layout: "horizontal",
    condition: "referral_data_exists",
    progressCue: "First, a few quick background questions to make sure I have everything right.",
    routing: {
      "All correct": "continue",
      "Something needs updating": "follow_up_flagged_fields"
    },
    notes: "Stacked confirmation panel. Includes Sex field (important for MH — affects menstrual/pregnancy questions and was part of original risk stratification). ONLY stacked section. If no referral data, fall back to individual questions."
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
    notes: null
  },
  {
    id: "intake-sex",
    phase: 2,
    question: "And just to confirm — are you male or female?",
    chips: ["Male", "Female"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: null,
    notes: "Needed for conditional questions (menstrual, pregnancy) and clinical context."
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
    notes: "ALLERGY FLAG: If iodine or contrast dye allergy → affects imaging options (no CT urography with iodine contrast). Flag internally."
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
    notes: "MEDICATION FLAGS: Anticoagulants/antiplatelets (warfarin, apixaban, etc.) — note but does NOT change evaluation. If patient says 'my doctor thinks it's from blood thinners' → address with anticoagulation rule."
  },
  {
    id: "intake-medical-history",
    phase: 2,
    question: "Any major medical conditions — like diabetes, heart disease, kidney problems, high blood pressure?",
    chips: ["Nothing significant", "Yes"],
    layout: "horizontal",
    condition: "no_referral_data",
    progressCue: null,
    routing: {
      "Nothing significant": "continue",
      "Yes": "follow_up_text"
    },
    notes: "FLAGS: Kidney disease/elevated creatinine → medical renal disease pathway. Hypertension → may relate to renal disease."
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
    notes: "FLAGS: Prior urologic surgery/instrumentation → possible benign cause. Prior pelvic surgery → relevant context."
  },
  {
    id: "intake-pregnancy",
    phase: 2,
    question: "Any chance you could be pregnant right now?",
    chips: ["No", "Yes", "Not sure"],
    layout: "horizontal",
    condition: "female AND childbearing_age",
    progressCue: null,
    routing: {
      "Yes": "flag_pregnancy_imaging_limit",
      "Not sure": "flag_pregnancy_imaging_limit"
    },
    notes: "PREGNANCY FLAG: If yes or possible → imaging limited to ultrasound only. No CT. Skip for men and postmenopausal women."
  },

  // =========================================================================
  // PHASE 3: RISK FACTOR ASSESSMENT (11 Questions)
  // =========================================================================

  {
    id: "risk-q1-smoking",
    phase: 3,
    question: "Do you smoke, or have you ever smoked?",
    chips: ["Never", "I used to", "Yes, currently"],
    layout: "horizontal",
    condition: null,
    progressCue: "Thanks for confirming all that. Now I need to ask about some specific things that help me figure out how carefully we need to look into this. About eleven questions — some quick, some need a bit more detail.",
    routing: {
      "Never": "continue_no_risk",
      "I used to": "ask_smoking_sub_questions_former",
      "Yes, currently": "ask_smoking_sub_questions_current"
    },
    notes: "Any smoking history = risk factor = Path 2 at minimum."
  },
  {
    id: "risk-q1a-smoking-amount",
    phase: 3,
    question: "About how many cigarettes a day — a few, half a pack, a pack, or more?",
    chips: ["A few cigarettes", "Half a pack", "About a pack", "More than a pack"],
    layout: "horizontal",
    condition: "smoking != Never",
    progressCue: null,
    routing: null,
    notes: "Used for pack-year calculation (internal). Any smoking = risk factor regardless of amount."
  },
  {
    id: "risk-q1b-smoking-years",
    phase: 3,
    question: "And roughly how many years?",
    chips: ["Less than 5", "5–10 years", "10–20 years", "More than 20 years"],
    layout: "horizontal",
    condition: "smoking != Never",
    progressCue: null,
    routing: null,
    notes: "Used for pack-year calculation (internal). Document in SOAP."
  },
  {
    id: "risk-q1c-smoking-quit",
    phase: 3,
    question: "How long ago did you quit?",
    chips: ["Less than a year", "1–5 years", "5–10 years", "More than 10 years"],
    layout: "horizontal",
    condition: "smoking == I used to",
    progressCue: null,
    routing: null,
    notes: "Only for former smokers. Context for SOAP."
  },

  {
    id: "risk-q2-gross-hematuria",
    phase: 3,
    question: "Have you ever noticed blood in your pee that you could actually see — like pink, red, or brown?",
    chips: ["No, never", "Yes"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No, never": "continue",
      "Yes": "path_3_trigger_ask_when"
    },
    notes: "CRITICAL: Gross hematuria at ANY point = Path 3 (scope + US + cytology + CT). If Yes → ask when."
  },
  {
    id: "risk-q2a-gross-when",
    phase: 3,
    question: "When was the last time that happened?",
    chips: ["In the last few weeks", "A few months ago", "More than a year ago"],
    layout: "horizontal",
    condition: "gross_hematuria == Yes",
    progressCue: null,
    routing: {
      "In the last few weeks": "assess_if_acute"
    },
    notes: "If currently ongoing with clots or difficulty voiding → emergency routing."
  },

  {
    id: "risk-q3-irritative",
    phase: 3,
    question: "Do you get a strong sudden urge to pee, find yourself going very often, or have any burning when you pee?",
    chips: ["No, none of those", "Yes — one or more of these"],
    layout: "horizontal",
    condition: null,
    progressCue: "Good — keep going.",
    routing: {
      "No, none of those": "continue",
      "Yes — one or more of these": "risk_factor_present"
    },
    notes: "Irritative LUTS = additional risk factor = Path 2 at minimum."
  },

  {
    id: "risk-q4-occupational",
    phase: 3,
    question: "Have you ever worked with chemicals, dyes, rubber, or in manufacturing — like in a factory or industrial setting?",
    chips: ["No", "Yes", "Not sure"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No": "continue",
      "Yes": "risk_factor_present",
      "Not sure": "continue"
    },
    notes: "Occupational exposure (benzene, aromatic amines, rubber, petrochemicals, dyes) = risk factor = Path 2."
  },

  {
    id: "risk-q5-family-history",
    phase: 3,
    question: "Has anyone in your family had bladder cancer, kidney cancer, or colon cancer?",
    chips: ["No", "Yes", "Not sure"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No": "continue",
      "Yes": "ask_family_details",
      "Not sure": "continue"
    },
    notes: "If Yes → follow up to determine type. Lynch syndrome or genetic renal cancer syndrome → Path 3 trigger."
  },
  {
    id: "risk-q5a-family-details",
    phase: 3,
    question: "Who in the family, and which type of cancer?",
    chips: null,
    layout: null,
    condition: "family_history == Yes",
    progressCue: null,
    routing: null,
    notes: "Open text. AI determines if Lynch syndrome or genetic renal syndrome applies. Lynch or hereditary kidney cancer → Path 3."
  },

  {
    id: "risk-q6-radiation",
    phase: 3,
    question: "Have you ever had radiation treatment to your belly or pelvis area — for any kind of cancer?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: null,
    progressCue: "Past the halfway mark.",
    routing: {
      "No": "continue",
      "Yes": "risk_factor_present"
    },
    notes: "Prior pelvic radiation = risk factor = Path 2."
  },

  {
    id: "risk-q7-chemo",
    phase: 3,
    question: "Have you ever had chemotherapy — specifically a drug called cyclophosphamide (sometimes called Cytoxan) or ifosfamide?",
    chips: ["No", "Yes", "I've had chemo but don't know the drug"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No": "continue",
      "Yes": "path_3_trigger",
      "I've had chemo but don't know the drug": "follow_up_chemo_type"
    },
    notes: "Cyclophosphamide/ifosfamide = Path 3 trigger. If they don't know the drug, AI asks what cancer it was for and uses clinical judgment."
  },

  {
    id: "risk-q8-menstrual",
    phase: 3,
    question: "Were you on your period when the urine test was done?",
    chips: ["No", "Yes", "Not sure", "I'm past menopause"],
    layout: "horizontal",
    condition: "female",
    progressCue: null,
    routing: {
      "Yes": "flag_menstrual_contamination",
      "Not sure": "flag_menstrual_contamination"
    },
    notes: "If yes or uncertain → specimen may have been contaminated. May need repeat UA. Skip for men. 'I'm past menopause' = move on."
  },

  {
    id: "risk-q9-uti",
    phase: 3,
    question: "Have you had a urinary tract infection recently — in the last few months?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No": "continue",
      "Yes": "ask_uti_followup"
    },
    notes: "If Yes → AI asks if it was culture-confirmed and if UA was repeated after treatment. UTI does NOT explain away MH without confirmed resolution."
  },
  {
    id: "risk-q9a-uti-culture",
    phase: 3,
    question: "Was it confirmed with a urine culture, or treated based on symptoms?",
    chips: ["Confirmed with culture", "Treated based on symptoms", "Not sure"],
    layout: "horizontal",
    condition: "recent_uti == Yes",
    progressCue: null,
    routing: null,
    notes: "Women frequently treated empirically without culture — flag if treated without confirmation."
  },
  {
    id: "risk-q9b-uti-repeat-ua",
    phase: 3,
    question: "Was a urine test repeated after the infection was treated?",
    chips: ["Yes", "No", "Not sure"],
    layout: "horizontal",
    condition: "recent_uti == Yes",
    progressCue: null,
    routing: null,
    notes: "If no repeat UA → add to plan. MH persisting after UTI treatment requires evaluation."
  },

  {
    id: "risk-q10-flank-pain",
    phase: 3,
    question: "Any pain in your side or lower back that comes and goes?",
    chips: ["No", "Yes"],
    layout: "horizontal",
    condition: null,
    progressCue: "Almost done.",
    routing: {
      "No": "continue",
      "Yes": "note_possible_stones"
    },
    notes: "May suggest kidney stones. Note for evaluation planning."
  },

  {
    id: "risk-q11-prior-evaluation",
    phase: 3,
    question: "Has blood in your pee ever been found before — and if so, was anything done about it?",
    chips: ["No, this is the first time", "Found before, but never investigated", "Found before, and I had tests done"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "No, this is the first time": "first_occurrence",
      "Found before, but never investigated": "recurrent_not_evaluated",
      "Found before, and I had tests done": "ask_prior_workup_details"
    },
    notes: "CRITICAL: If prior full workup (cystoscopy + imaging + cytology) within 1 year and still has hematuria → Outcome C (too complex, needs in-person). If found before but not investigated → persistent MH = Path 2 at minimum."
  },
  {
    id: "risk-q11a-prior-workup",
    phase: 3,
    question: "Do you remember what tests were done and roughly when?",
    chips: null,
    layout: null,
    condition: "prior_evaluation == tests_done",
    progressCue: null,
    routing: null,
    notes: "Open text. AI determines if full workup was completed within 1 year. If yes → Outcome C. If >1 year or incomplete workup → proceed with new evaluation."
  },

  // =========================================================================
  // PHASE 4: CONTEXTUAL QUESTIONS (Humanizing)
  // =========================================================================

  {
    id: "context-q1-when-found-out",
    phase: 4,
    question: "When did you first find out about the blood in your pee?",
    chips: ["Just recently", "A few weeks ago", "A few months ago", "It's been a while"],
    layout: "horizontal",
    condition: null,
    progressCue: "That's the medical background done. Just two more — these are about how you're feeling about all this.",
    routing: null,
    notes: null
  },
  {
    id: "context-q2-worries",
    phase: 4,
    question: "Is there anything about this that's been worrying you?",
    chips: ["Not really worried", "A little nervous", "Quite worried", "I'm scared it could be cancer"],
    layout: "horizontal",
    condition: null,
    progressCue: null,
    routing: {
      "Not really worried": "continue",
      "A little nervous": "continue",
      "Quite worried": "extra_reassurance",
      "I'm scared it could be cancer": "address_cancer_fear"
    },
    notes: "If cancer fear → address directly per prompt's COMMON QUESTIONS section. Do NOT introduce cancer if patient doesn't. All answers are terminal — record and continue to outcome."
  },

  // =========================================================================
  // PHASE 5: OUTCOME DELIVERY (Drip-Feed)
  // =========================================================================
  // No confirmation question needed — the risk factors determine the path.
  // No medication choice — this is a test-ordering tool.

  // PATH 1: Repeat UA (low risk)
  {
    id: "outcome-path1-ack-1",
    phase: 5,
    question: null,
    fingerprints: [
      "very small chance of anything serious",
      "nothing concerning in your background",
      "doesn't look concerning",
      "on the reassuring side",
      "no smoking, no family history",
    ],
    chips: ["That's reassuring", "I have a question"],
    layout: "horizontal",
    condition: "path_1",
    progressCue: null,
    routing: {
      "That's reassuring": "continue_to_message_2",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 1 (assessment — low risk, very small chance of anything serious). AI waits for acknowledgment. Fingerprints are the text-match fallback when the marker drops."
  },
  {
    id: "outcome-path1-ack-2",
    phase: 5,
    question: null,
    fingerprints: [
      "repeat in 6 months",
      "repeat the urine test",
      "repeat UA",
      "check it again in six months",
      "one thing to do",
    ],
    chips: ["Sounds good", "I have a question"],
    layout: "horizontal",
    condition: "path_1_message_1_acknowledged",
    progressCue: null,
    routing: {
      "Sounds good": "continue_to_message_3",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 2 (plan — repeat UA in 6 months, smoking cessation if applicable). AI waits for acknowledgment. Fingerprints are the text-match fallback when the marker drops."
  },

  // PATH 2: Scope + US + Cytology
  {
    id: "outcome-path2-ack-1",
    phase: 5,
    question: null,
    fingerprints: [
      "closer look makes sense",
      "being thorough",
      "background puts you in a zone",
      "want to check things out properly",
      "zone where a closer look",
    ],
    chips: ["Okay, makes sense", "I have a question"],
    layout: "horizontal",
    condition: "path_2",
    progressCue: null,
    routing: {
      "Okay, makes sense": "continue_to_message_2",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 1 (assessment — closer look makes sense, being thorough). AI waits for acknowledgment. Fingerprints are the text-match fallback when the marker drops."
  },
  {
    id: "outcome-path2-ack-2",
    phase: 5,
    question: null,
    fingerprints: [
      "ultrasound of the kidneys",
      "camera look inside the bladder",
      "urine test that looks for any signs",
      "three things",
      "get all three ordered",
    ],
    chips: ["Got it", "I have a question"],
    layout: "horizontal",
    condition: "path_2_message_1_acknowledged",
    progressCue: null,
    routing: {
      "Got it": "continue_to_message_3",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 2 (plan — ultrasound + cystoscopy + urine cytology, what each is). AI waits for acknowledgment. Fingerprints are the text-match fallback when the marker drops."
  },

  // PATH 3: Scope + US + Cytology + CT
  {
    id: "outcome-path3-ack-1",
    phase: 5,
    question: null,
    fingerprints: [
      "extra thorough",
      "more complete checkup",
      "doesn't mean something is wrong",
      "smart move",
      "we want to be careful",
      "want to be extra thorough",
    ],
    chips: ["Okay, I understand", "I have a question"],
    layout: "horizontal",
    condition: "path_3",
    progressCue: null,
    routing: {
      "Okay, I understand": "continue_to_message_2",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 1 (assessment — being extra thorough based on history, doesn't mean something is wrong). AI waits for acknowledgment. Fingerprints are the text-match fallback when the marker drops."
  },
  {
    id: "outcome-path3-ack-2",
    phase: 5,
    question: null,
    fingerprints: [
      "CT urography",
      "detailed scan of the kidneys",
      "four things",
      "special dye to show us the whole urinary",
      "get all four ordered",
      "MRI-based scan",
    ],
    chips: ["Got it", "I have a question"],
    layout: "horizontal",
    condition: "path_3_message_1_acknowledged",
    progressCue: null,
    routing: {
      "Got it": "continue_to_message_3",
      "I have a question": "answer_then_continue"
    },
    notes: "After Message 2 (plan — ultrasound + cystoscopy + urine cytology + CT urography, what each is). AI waits for acknowledgment. Fingerprints are the text-match fallback when the marker drops."
  },

];

export default MH_QUESTION_REGISTRY;
