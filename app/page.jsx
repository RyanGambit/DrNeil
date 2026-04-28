"use client";

import { useState, useRef, useEffect } from "react";
import ED_QUESTION_REGISTRY from "../prompts/ed-question-registry";
import BPH_QUESTION_REGISTRY from "../prompts/bph-question-registry";
import MH_QUESTION_REGISTRY from "../prompts/mh-question-registry";

// Condition-scoped registries. IDs can collide across conditions
// (e.g., all three have "opening-safety-screen", "intake-confirm", etc.)
// but the questions and chips differ, so every lookup MUST pass the
// condition.
const REGISTRIES = {
  ed: ED_QUESTION_REGISTRY,
  bph: BPH_QUESTION_REGISTRY,
  mh: MH_QUESTION_REGISTRY,
};

function getRegistry(condition) {
  return REGISTRIES[condition] || null;
}

// Phase labels by condition. The phase numbers roughly track the consult
// arc but the clinical content behind each phase differs between conditions
// (e.g. ED phase 5 = CV screen; BPH phase 5 = outcome determination;
// MH phase 5 = outcome delivery — there's no safety gate in MH).
const PHASE_LABELS_BY_CONDITION = {
  ed: {
    1: "Getting started",
    2: "Background questions",
    3: "Symptom check-in",
    4: "Understanding your situation",
    5: "Safety check",
    6: "Final checks",
    7: "Wrapping up",
  },
  bph: {
    1: "Getting started",
    2: "Background questions",
    3: "Symptom check-in",
    4: "Rounding out the picture",
    5: "Making the plan",
    6: "Final safety checks",
    7: "Wrapping up",
  },
  mh: {
    1: "Getting started",
    2: "Background questions",
    3: "Risk factor check",
    4: "Understanding your situation",
    5: "Wrapping up",
  },
};

// Condition detection is handled server-side via /api/detect-condition

const CONDITION_LABELS = {
  bph: "BPH / Lower Urinary Tract Symptoms",
  ed: "Erectile Dysfunction",
  mh: "Microhematuria",
  unknown: "Unclassified — Requires Review",
};

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO DATABASE — Pre-built test patients for each condition
// ═══════════════════════════════════════════════════════════════════════
const SCENARIO_DB = [
  {
    id: "bph-1", condition: "bph", label: "Straightforward BPH — Outcome B candidate",
    summary: "61M, moderate LUTS, normal PSA, mild enlargement",
    data: {
      name: "Michael Tran", age: "61", sex: "Male", mrn: "UHN-2024-44891",
      pcp: "Dr. Anita Deshpande", referralReason: "Progressive lower urinary tract symptoms including frequency, nocturia (3x/night), hesitancy, weak stream, and post-void dribbling. Symptoms worsening over the past 8 months.",
      psa: "1.2 ng/mL", freePsa: "0.28", ua: "Normal — no blood, no infection",
      prostateVolume: "35cc", pvr: "75 mL", creatinine: "88 µmol/L", egfr: "82 mL/min",
      medicalHistory: ["Hypertension (controlled)", "Dyslipidemia"],
      surgicalHistory: ["Appendectomy (1995)", "Colonoscopy (2022)"],
      allergies: "None known",
      medications: ["Ramipril 10mg daily", "Rosuvastatin 20mg daily"],
    },
  },
  {
    id: "bph-2", condition: "bph", label: "Elevated PSA — Needs in-person",
    summary: "58M, moderate symptoms, PSA above age threshold",
    data: {
      name: "Robert Chen", age: "58", sex: "Male", mrn: "UHN-2024-55102",
      pcp: "Dr. Brian Lam", referralReason: "Urinary frequency and nocturia x4. PSA noted to be elevated on routine screening.",
      psa: "3.1 ng/mL", freePsa: "0.18", ua: "Normal", prostateVolume: "42cc", pvr: "110 mL",
      creatinine: "95 µmol/L", egfr: "76 mL/min",
      medicalHistory: ["Type 2 Diabetes", "Hypertension", "Obesity (BMI 33)"],
      surgicalHistory: ["None"],
      allergies: "Sulfa drugs",
      medications: ["Metformin 1000mg BID", "Lisinopril 20mg daily", "Atorvastatin 40mg daily"],
    },
  },
  {
    id: "ed-1", condition: "ed", label: "First-time ED — PDE5i naive",
    summary: "58M, gradual onset, vascular risk factors, never tried medication",
    data: {
      name: "David Park", age: "58", sex: "Male", mrn: "UHN-2024-60215",
      pcp: "Dr. Sarah Mitchell", referralReason: "Erectile dysfunction — progressive difficulty obtaining and maintaining erections over past 18 months. No prior treatment attempted. Patient requesting specialist assessment.",
      testosterone: "14.2 nmol/L", fastingGlucose: "6.1 mmol/L", hba1c: "6.3%",
      lipids: "LDL 3.4 mmol/L", psa: "1.8 ng/mL", priorEdTreatment: "None",
      edDuration: "18 months", edSeverity: "Moderate",
      medicalHistory: ["Hypertension (controlled)", "Dyslipidemia", "Pre-diabetes"],
      surgicalHistory: ["Inguinal hernia repair (2018)"],
      allergies: "None known",
      medications: ["Amlodipine 5mg daily", "Rosuvastatin 10mg daily"],
    },
  },
  {
    id: "ed-2", condition: "ed", label: "PDE5i failure — Needs second-line",
    summary: "65M, tried sildenafil 100mg x8 with proper use, still failing",
    data: {
      name: "Mark Stevens", age: "65", sex: "Male", mrn: "UHN-2024-61003",
      pcp: "Dr. James Wong", referralReason: "Erectile dysfunction refractory to sildenafil. Tried sildenafil 50mg then 100mg with proper timing and technique, 8+ attempts. No satisfactory response. Requesting urology assessment for second-line options.",
      testosterone: "11.8 nmol/L", fastingGlucose: "7.2 mmol/L", hba1c: "7.1%",
      lipids: "LDL 2.8 mmol/L", psa: "2.4 ng/mL",
      priorEdTreatment: "Sildenafil 50mg then 100mg — 8 attempts, no adequate response",
      edDuration: "3 years", edSeverity: "Severe",
      medicalHistory: ["Type 2 Diabetes", "Hypertension", "Coronary artery disease (stable, stented 2020)"],
      surgicalHistory: ["Coronary stenting (2020)", "Cholecystectomy (2012)"],
      allergies: "Penicillin",
      medications: ["Metformin 1000mg BID", "Ramipril 10mg daily", "ASA 81mg daily", "Atorvastatin 80mg daily", "Metoprolol 50mg BID"],
    },
  },
  {
    id: "mh-1", condition: "mh", label: "Intermediate risk — On blood thinner",
    summary: "63F, 18 RBC/HPF, on apixaban for AFib",
    data: {
      name: "Margaret (Peggy) Whitfield", age: "63", sex: "Female", mrn: "UHN-2024-70442",
      pcp: "Dr. Helen Chow", referralReason: "Microscopic hematuria found on routine urinalysis. 18 RBC/HPF on microscopy. Patient on anticoagulation for atrial fibrillation.",
      rbcHpf: "18 RBC/HPF", uaMethod: "Microscopy", dipstick: "2+ blood",
      proteinuria: "Negative", urineCulture: "No growth", creatinine: "72 µmol/L", egfr: "78 mL/min",
      medicalHistory: ["Atrial fibrillation", "Hypertension", "Osteoarthritis"],
      surgicalHistory: ["Total knee replacement (2021)", "Hysterectomy (2008)"],
      allergies: "Iodine contrast dye",
      medications: ["Apixaban 5mg BID", "Metoprolol 50mg daily", "Amlodipine 5mg daily"],
      priorImaging: "None",
    },
  },
  {
    id: "mh-2", condition: "mh", label: "Low risk — Reassurance pathway",
    summary: "38M, 5 RBC/HPF, never smoker, no risk factors",
    data: {
      name: "Thomas Brown", age: "38", sex: "Male", mrn: "UHN-2024-71558",
      pcp: "Dr. Maria Santos", referralReason: "Incidental microscopic hematuria found on pre-employment physical. 5 RBC/HPF. Patient anxious — requesting specialist evaluation.",
      rbcHpf: "5 RBC/HPF", uaMethod: "Microscopy", dipstick: "Trace blood",
      proteinuria: "Negative", urineCulture: "No growth", creatinine: "82 µmol/L", egfr: "105 mL/min",
      medicalHistory: ["None"],
      surgicalHistory: ["Wisdom teeth extraction (2010)"],
      allergies: "None known",
      medications: ["None"],
      priorImaging: "None",
    },
  },

  // =====================================================================
  // EDGE CASES — high-stakes branches the AI must route correctly.
  // Each one is intentionally adversarial: a wrong answer would be a
  // clinically meaningful mistake. Used by the QA harness only — they're
  // visible in the test-scenarios picker so the reviewing physician can
  // also demo them manually.
  // =====================================================================
  {
    id: "ed-3", condition: "ed", label: "Nitrate user — ABSOLUTE CONTRAINDICATION (Outcome C)",
    summary: "67M, stable angina on PRN nitroglycerin — sildenafil contraindicated",
    data: {
      name: "Frank Delgado", age: "67", sex: "Male", mrn: "UHN-2024-62288",
      pcp: "Dr. Elena Roussos", referralReason: "Erectile dysfunction. Progressive over 2 years. Has stable angina, uses sublingual nitroglycerin spray as needed (last used ~2 weeks ago for chest pain on exertion). Requesting medication.",
      testosterone: "12.4 nmol/L", fastingGlucose: "6.4 mmol/L", hba1c: "6.4%",
      lipids: "LDL 2.6 mmol/L", psa: "2.1 ng/mL",
      priorEdTreatment: "None — has heard about sildenafil from friends",
      edDuration: "2 years", edSeverity: "Moderate to severe",
      medicalHistory: ["Stable angina (CCS class II)", "Hypertension", "Dyslipidemia", "Former smoker (quit 2018)"],
      surgicalHistory: ["Coronary angiogram 2019 — non-obstructive disease"],
      allergies: "None known",
      medications: ["Nitroglycerin 0.4mg SL spray PRN", "Metoprolol 50mg BID", "Ramipril 10mg daily", "Atorvastatin 40mg daily", "ASA 81mg daily"],
    },
  },
  {
    id: "ed-4", condition: "ed", label: "Young, sudden onset, situational — psychogenic differential",
    summary: "32M, ED for 3 months, situational (fine on own), normal hormones",
    data: {
      name: "Alex Rivera", age: "32", sex: "Male", mrn: "UHN-2024-63110",
      pcp: "Dr. Priya Iyer", referralReason: "Sudden-onset erectile dysfunction over the past 3 months. Patient reports normal morning erections and no problem with self-stimulation, but unable to maintain erection with new partner. Recent job change and high stress noted. Requesting evaluation.",
      testosterone: "18.6 nmol/L", fastingGlucose: "4.8 mmol/L", hba1c: "5.2%",
      lipids: "LDL 2.1 mmol/L", psa: "0.6 ng/mL",
      priorEdTreatment: "None",
      edDuration: "3 months", edSeverity: "Mild — situational",
      medicalHistory: ["Anxiety (intermittent, no medication)"],
      surgicalHistory: ["None"],
      allergies: "None known",
      medications: ["None"],
    },
  },
  {
    id: "bph-3", condition: "bph", label: "Severe LUTS + high PVR — Urgent in-person (no Rx)",
    summary: "72M, severe symptoms, PVR 380 mL, possible chronic retention",
    data: {
      name: "Henryk Kowalski", age: "72", sex: "Male", mrn: "UHN-2024-45670",
      pcp: "Dr. Sandra Park", referralReason: "Severe LUTS with sense of incomplete emptying. Reports straining, very weak stream, dribbling, and feeling 'never quite empty'. PVR by bladder scan is 380 mL. Creatinine modestly up from baseline. Requesting urgent assessment.",
      psa: "4.6 ng/mL", freePsa: "0.22", ua: "Trace blood, otherwise normal",
      prostateVolume: "78cc", pvr: "380 mL", creatinine: "118 µmol/L", egfr: "58 mL/min",
      medicalHistory: ["Hypertension", "Type 2 diabetes (controlled)", "Hyperlipidemia"],
      surgicalHistory: ["Cataract surgery 2020"],
      allergies: "None known",
      medications: ["Amlodipine 10mg daily", "Metformin 1000mg BID", "Atorvastatin 20mg daily"],
    },
  },
  {
    id: "mh-3", condition: "mh", label: "High-risk — Smoker, intermittent gross hematuria",
    summary: "68M, 35 pack-year smoker, occasional visible red urine — needs imaging + cysto",
    data: {
      name: "Walter Hayes", age: "68", sex: "Male", mrn: "UHN-2024-72990",
      pcp: "Dr. Frank Holland", referralReason: "Microscopic hematuria on routine urinalysis (28 RBC/HPF). On further history, patient reports 2 episodes of pink-to-red urine over the past 4 months that resolved spontaneously. 35 pack-year smoking history (current smoker, ½ ppd). Worked in a printing plant for 25 years.",
      rbcHpf: "28 RBC/HPF", uaMethod: "Microscopy", dipstick: "3+ blood",
      proteinuria: "Negative", urineCulture: "No growth", creatinine: "94 µmol/L", egfr: "78 mL/min",
      medicalHistory: ["Hypertension", "COPD (mild)", "Hyperlipidemia"],
      surgicalHistory: ["Inguinal hernia 2010"],
      allergies: "None known",
      medications: ["Amlodipine 5mg daily", "Tiotropium inhaler", "Atorvastatin 20mg daily"],
      priorImaging: "None",
    },
  },
  {
    id: "mh-4", condition: "mh", label: "Premenopausal female, low RBC — Menstrual contamination differential",
    summary: "28F, 4 RBC/HPF, sample taken near period — likely contamination",
    data: {
      name: "Jasmine Okafor", age: "28", sex: "Female", mrn: "UHN-2024-73881",
      pcp: "Dr. Luca Bianchi", referralReason: "Microscopic hematuria found on urinalysis ordered for fatigue workup. 4 RBC/HPF. Patient mentions the sample was collected during the last day of her menstrual period. No urinary symptoms. No risk factors.",
      rbcHpf: "4 RBC/HPF", uaMethod: "Microscopy", dipstick: "Trace blood",
      proteinuria: "Negative", urineCulture: "No growth", creatinine: "62 µmol/L", egfr: "118 mL/min",
      medicalHistory: ["None"],
      surgicalHistory: ["None"],
      allergies: "None known",
      medications: ["Combined oral contraceptive"],
      priorImaging: "None",
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════
// DR. FLESHNER AVATAR (base64)
// ═══════════════════════════════════════════════════════════════════════
const DR_AVATAR = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCABgAGADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBlLilApwFUSNxS4p2KZPKkELSP0HYdz6UAKcAZJwKqtqFmrbTOuf0qrP5t7Iq7HYbsMgbhfw71Y/sotCVKMSAcE/pUuSRSi2Sm7tlYAzICfepRhgCpBB6EVnDSnER3A4BwvHamQyppsoieQ+VjkH+HngimncTTRqYoxTyKQimIZikNOxSYoGSgUtFLigQlU2BvNQ+zpyIhyc9Gq9/KoPDkeb+SQtlXY4z3pMaNOwsobZAiLz1JPUmtVIMp0FVl2pckdqvx7yvBArl3Z2rRaFC5hCAnA4rmb+GOW5DMoyp7jtXX3KhkIZh/jXM6hCsc6sSACcEHvQrphJJxKtnIVd7dyDsPynParlZ8URF9FKAyiQAkHoTjn8a0sV1I4hhFJinUGmIcKdikxTgKBkdwD9nkx12motNY2sbT4DFfljQepOKt44qks6mRoomQlDkbe2Ov41MnYcVd2LRmuYJJJZZnPz/KoHzAY6dPWoi2ryzKymWNCRhXcZP5dK1bYrMCGAyTkH0qwztFII0SNnboByceprn5jr5ChqS3C6WZEI81DlifeuVawvHUSkrIzEHG05Nd1NJamCdJZkJC/Nn1rmrHUkaOREdGQEgNjg0JtD5E2EFksahjlWBDDb+v9KuY4qjBqAnuxE2D8oHyjjPNaGK6Y7HHJWZGRSEVJTSKZI8ClAoApwFAxDwpJ6AZrnlvVsdaS5JDx+YfkUYJBroyMqR61x2oWM9rd4kSRwW3B1Bbd+P9KTVxp2dzsLKZLqMy278Ell/PpVq3EtuSyxtMzEF33DP5egrM0qwu7DS4HkBBfLopGDj0Pv3rSsLtPMwWBDdvSuRrllY7Yvmjck1OCO7sirxhh6eYBmuNhhAubhXQRQxqcfNnJrt7yHzUGyYqvoBXH38AmvI7G2cs5cs7N/Wr30Qnork2jxF53lJKpyyr2Oe9bGKrabZfYrYRs5dz1Yn9B7VbxXQlZWONu7uRkU0ipSKaRTEKBTgKQU2W4igXMjc9gOpoAlAqpcTCQGOI8fxEd/aqlxeSzZUfInpTbd9uVJyc0AdZo9zFfWf2OcfOg49x6j3FZ+q6FJAxnhJK5zuXt9fSs2GZ4ZVliYq6HKkdq7PTL+PULbeuFkXh09D/AIVE4KRcKjicDdzXkcRCznFZWlvImrQMDl5JNp+mCTXoGu6DHdoWtsRSkc8fKfw7Vy2j6PPHqcs96BGbMYRCRlmP8X0x396iMWmaSmpLQ1IpoZxmGVHx12nOKfiuHaOaNyx3RzKfm5xk1p2Gt3MZCzHzl/2uCPxrYwOkIpCKrW2qW1w6p8yO3ADdCfTNXCKAKdzclF2wgM3c9lrNKszFmOWPUmragbSc/lUMg2ncOnf2oAZgAU0sFwcgHPGe9OYfSkZFePBAPPegROre/B6Vb029axukkDHZnD49PWs5AEwoJNPB9RQB3d5qcFpYNdSAuduVVRkyE9AK4DUriY3C6oj5lDbmI6Y7j6V02gXQuLdrGbBaP5oyfT/61Y+sQrHqc0SIBGwAZR7jrVw7CkQ6zFHOkV5Gm3cNrjHHqDnuKwnhAkDDj1xXS6IRd6TLYSH54jsGeo/un+lYVzGyuUPysp7ipatoMqyMUVsZBAyPYjmuwspTc2UMx6ugJ+tchKpAAbkEba6LwzJ5ukKveNiv9aQI/9k=";

// ═══════════════════════════════════════════════════════════════════════
// PARSE UPLOADED PATIENT FILE
// ═══════════════════════════════════════════════════════════════════════
function parsePatientFile(text) {
  const data = {};
  
  // Smart extractor — tries multiple labels, handles multi-line indented values
  const extract = (...labels) => {
    for (const label of labels) {
      const regex = new RegExp(label + "[:\\\\s]+([^\\n]+(?:\\n\\s{2,}[^\\n]+)*)", "i");
      const match = text.match(regex);
      if (match) {
        const val = match[1].replace(/\\s+/g, " ").trim();
        if (val && !val.startsWith("═") && !val.startsWith("─") && val.length > 0) return val;
      }
    }
    return null;
  };

  // Section extractor — gets content between section dividers
  const extractSection = (...names) => {
    for (const name of names) {
      const regex = new RegExp(name + "[\\\\s═─]*\\n([\\\\s\\\\S]*?)(?=\\n═|\\n──|$)", "i");
      const match = text.match(regex);
      if (match && match[1].trim()) return match[1].trim();
    }
    return null;
  };

  // ── Common demographics ──
  data.name = extract("Patient Name", "Name");
  data.age = extract("Age");
  data.sex = extract("Sex");
  data.mrn = extract("MRN", "Health Card #", "Health Card");
  data.language = extract("Primary language");
  data.pcp = extract("Primary Care Physician", "Referring Physician", "Family Physician");
  
  data.referralType = extract("Referral Type");
  data.referralDate = extract("Referral Date");
  
  // Flexible referral reason
  const reasonQuoted = text.match(/Reason for referral[^"]*"([^"]+)"/s);
  const reasonUnquoted = text.match(/Reason for referral[:\s]+([^\n]+(?:\n\s{2,}[^\n]+)*)/i);
  data.referralReason = reasonQuoted 
    ? reasonQuoted[1].replace(/\s+/g, " ").trim() 
    : reasonUnquoted ? reasonUnquoted[1].replace(/\s+/g, " ").trim() : null;

  // ── BPH fields ──
  // PSA can appear as "PSA (ng/mL): 2.6" OR as a block with "PSA Value: 2.6 ng/mL"
  const psaInlineMatch = text.match(/PSA\s*\([^)]+\)[:\s]+(.+)/i);
  const psaValueMatch = text.match(/PSA\s+Value[:\s]+(.+)/i);
  data.psa = psaInlineMatch ? psaInlineMatch[1].trim()
    : psaValueMatch ? psaValueMatch[1].trim()
    : extract("PSA");
  data.freePsa = extract("Free/Total PSA ratio", "Free/Total Ratio", "Free PSA");
  
  const uaInlineMatch = text.match(/Urinalysis\s*\([^)]+\)[:\s]+(.+)/i);
  data.ua = uaInlineMatch ? uaInlineMatch[1].trim() : null;
  if (!data.ua) {
    // Handle block-format Urinalysis with separate RBC, WBC, Method lines
    // Use single-line extraction to avoid grabbing indented lines below
    const extractSingle = (label) => {
      const m = text.match(new RegExp(label + "[:\\s]+([^\\n]+)", "i"));
      return m ? m[1].trim() : null;
    };
    const rbcVal = extractSingle("RBC");
    const wbcVal = extractSingle("WBC");
    const uaMethodVal = extractSingle("Method");
    if (rbcVal) {
      let uaParts = [];
      if (wbcVal) uaParts.push("WBC: " + wbcVal);
      uaParts.push("RBC: " + rbcVal);
      const methodLabel = uaMethodVal ? " (" + uaMethodVal.toLowerCase() + ")" : "";
      data.ua = uaParts.join(", ") + methodLabel;
    }
  }
  
  data.creatinine = extract("Serum Creatinine", "Creatinine");
  data.egfr = extract("eGFR");

  const prostateMatch = text.match(/Prostate volume[:\s]+(.+)/i);
  data.prostateVolume = prostateMatch ? prostateMatch[1].trim() : null;
  
  const pvrMatch = text.match(/Post-void residual[:\s]+(.+)/i);
  data.pvr = pvrMatch ? pvrMatch[1].trim() : null;

  // ── ED fields ──
  data.testosterone = extract("Testosterone", "Total testosterone", "Serum testosterone");
  data.fastingGlucose = extract("Fasting glucose", "Glucose");
  data.hba1c = extract("HbA1C", "HbA1c", "A1C");
  data.lipids = extract("Lipid", "Cholesterol", "LDL");
  
  const priorEdMatch = text.match(/Prior ED treatment[s]?[:\s]+(.+)/i) 
    || text.match(/Previous treatment[s]?[:\s]+(.+)/i)
    || text.match(/PDE5i[:\s]+(.+)/i);
  data.priorEdTreatment = priorEdMatch ? priorEdMatch[1].trim() : null;
  data.edDuration = extract("ED duration", "Duration of ED", "Duration of symptoms");
  data.edSeverity = extract("Severity", "ED severity");

  // ── MH fields ──
  const rbcMatch = text.match(/RBC[:\s]+(\d+)\s*(?:\/HPF)?/i);
  data.rbcHpf = rbcMatch ? rbcMatch[1] + " RBC/HPF" : null;
  
  const cultureMatch = text.match(/Urine Culture[\s\S]*?Result[:\s]+(.+)/i);
  data.urineCulture = cultureMatch ? cultureMatch[1].trim() : extract("Culture result", "Culture");
  
  data.priorImaging = extract("Prior Imaging");
  data.proteinuria = extract("Proteinuria", "Protein(?!uria)");
  data.dipstick = extract("Dipstick Blood", "Dipstick");
  data.uaMethod = extract("Method", "UA Method");

  // ── Allergies ──
  data.allergies = extract("Allergies") || "None known";

  // ── Medical history ──
  const medHistRaw = extract("Active Conditions") || extractSection("5\\. Medical History", "MEDICAL HISTORY");
  if (medHistRaw) {
    data.medicalHistory = medHistRaw.split(/[,\n]/).map(l => l.replace(/^[●\-\s\d.]+/, "").trim()).filter(l => l && !l.startsWith("═"));
  }

  // ── Surgical history ──
  const surgRaw = extract("Prior Surgeries") || extractSection("6\\. Surgical History", "SURGICAL HISTORY");
  if (surgRaw) {
    data.surgicalHistory = surgRaw.split(/\n/).map(l => l.replace(/^[●\-\s\d.]+/, "").trim()).filter(l => l && !l.startsWith("═"));
  }

  // ── Medications ──
  const medsRaw = extractSection("CURRENT MEDICATIONS", "8\\. Current Medications");
  if (medsRaw) {
    data.medications = medsRaw.split("\n").map(l => l.replace(/^[●\-\s\d.]+/, "").trim()).filter(l => l && !l.startsWith("═") && l.length > 2);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// SIMPLE MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return "";
  // Escape HTML entities first to prevent XSS via AI responses
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    // Headers → bold text on its own line
    .replace(/^#{1,3}\s+(.+)$/gm, "<strong>$1</strong>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    // Bullet points → clean lines
    .replace(/^[-•]\s+/gm, "  · ")
    // Action links [Schedule Follow-Up] / [Schedule In-Person Visit] →
    // interactive buttons. The chat surface listens for clicks on
    // `[data-schedule-action]` and opens the simulated calendar modal.
    .replace(/\[Schedule ([^\]]+)\]/g, '<button type="button" data-schedule-action="$1" style="display:inline-block;margin:6px 0;padding:10px 18px;background:#1A6B5B;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:44px;">📅 Schedule $1</button>')
    // Double newlines → paragraph breaks
    .replace(/\n\n/g, "<br/><br/>")
    // Single newlines → line breaks
    .replace(/\n/g, "<br/>");
}

// ═══════════════════════════════════════════════════════════════════════
// REGISTRY-DRIVEN CHIP SYSTEM — AI appends <!-- qid:X --> markers,
// frontend looks up chips/layout from the active condition's registry
// (ED_QUESTION_REGISTRY or BPH_QUESTION_REGISTRY).
// ═══════════════════════════════════════════════════════════════════════

// Extract the hidden question ID marker from an AI message and return
// { cleanText, qid }. If no marker is present, qid is null and cleanText
// equals the original message. The marker regex is tolerant of whitespace
// and optional trailing newlines.
const QID_MARKER_RE = /\s*<!--\s*qid:([a-z0-9-]+)\s*-->\s*$/i;
function parseQID(messageText) {
  if (!messageText) return { cleanText: messageText, qid: null };
  const match = messageText.match(QID_MARKER_RE);
  const qid = match ? match[1] : null;
  // Strip the marker (if present) AND trim leading/trailing whitespace so
  // stray newlines from the AI don't render as blank lines at the top of
  // the bubble. Also collapses 3+ consecutive newlines to a double-newline
  // paragraph break — anything more than that is a formatting glitch.
  const stripped = match ? messageText.replace(QID_MARKER_RE, "") : messageText;
  const cleanText = stripped.trim().replace(/\n{3,}/g, "\n\n");
  return { cleanText, qid };
}

function getRegistryEntry(qid, condition) {
  if (!qid) return null;
  const registry = getRegistry(condition);
  if (!registry) return null;
  return registry.find((q) => q.id === qid) || null;
}

// FALLBACK: if the AI forgets the qid marker, try to recover by matching
// the AI message text against registry text. Only runs when the marker is
// missing. Scoped to the active condition's registry so BPH messages can't
// match ED entries.
//
// Two match modes:
//   1. For entries with a predefined `question` field, use the last
//      question-marked line as the needle (full-text match).
//   2. For contextual entries (question: null — e.g., outcome-b-ack-1,
//      outcome-medication-willingness), use the `fingerprints` array of
//      distinctive phrases. Any fingerprint hit is enough.
// In both cases longer needles/fingerprints are preferred (more specific).
function detectQidFromText(messageText, condition) {
  if (!messageText) return null;
  const registry = getRegistry(condition);
  if (!registry) return null;
  const lower = messageText.toLowerCase();

  const candidates = [];

  for (const e of registry) {
    if (e.question) {
      const lines = e.question.split("\n").map((l) => l.trim()).filter(Boolean);
      const qLine = lines.reverse().find((l) => l.includes("?")) || lines[0] || "";
      const needle = qLine.toLowerCase();
      if (needle.length >= 15) candidates.push({ id: e.id, needle });
    }
    if (Array.isArray(e.fingerprints)) {
      for (const fp of e.fingerprints) {
        const needle = String(fp).toLowerCase();
        if (needle.length >= 10) candidates.push({ id: e.id, needle });
      }
    }
  }

  candidates.sort((a, b) => b.needle.length - a.needle.length);
  for (const c of candidates) {
    if (lower.includes(c.needle)) return c.id;
  }
  return null;
}

// Non-committal responses that often trigger an AI rephrase of the same question.
// When we see one of these followed by a marker-less question from the AI, it's
// almost certainly a rephrase — so the previous assistant qid still applies.
const NON_COMMITTAL_RE = /^(not sure|maybe|i don['']?t know|idk|unsure|don['']?t know|i['']?m not sure|actually,?\s*i['']?m not sure about that)\s*\.?\s*$/i;

// Terminal-signal detection. Used by both the progress bar (to jump to 100%)
// and the session close-out logic (to trigger SOAP generation, disable input,
// show the Session Complete Card). Kept as a single shared function so the
// two code paths can't drift.
function isTerminalMessage(text) {
  if (!text) return false;
  return (
    // Schedule links (Outcome A/B closes). "Tests" (plural) for MH,
    // "Testing" for ED/BPH — keep both.
    /\[Schedule (Follow-Up|In-Person Visit|Testing|Tests)\]/i.test(text) ||
    /Take care[,!\s]/i.test(text) ||
    /stop the pill and go to the ER/i.test(text) ||
    /(get you|let'?s get you|you should get) scheduled (for|in) (an?\s+)?in[- ]person/i.test(text) ||
    /(go to|head to) (the )?(emergency (department|room)|ER)\b/i.test(text) ||
    /(go to|visit|head to)(\s+a| the)?\s+walk[- ]in clinic/i.test(text)
  );
}

function resolveEntry(msg, messages, index, condition) {
  // All three layers are scoped to the active condition's registry so
  // BPH messages can't accidentally match ED entries and vice versa.

  // 1. Direct marker lookup (happy path)
  const direct = getRegistryEntry(msg.qid, condition);
  if (direct) return direct;

  // 2. Text match against registry questions (AI dropped the marker but kept
  //    the verbatim question text)
  const fallbackQid = detectQidFromText(msg.text, condition);
  const byText = fallbackQid ? getRegistryEntry(fallbackQid, condition) : null;
  if (byText) return byText;

  // 3. Contextual rephrase fallback — only when we have messages/index.
  //    If the current assistant message asks a "?" and the patient's most
  //    recent response was non-committal ("Not sure" etc.), assume the AI
  //    is rephrasing and reuse the previous assistant qid.
  if (!messages || typeof index !== "number") return null;
  if (!msg.text || !msg.text.includes("?")) return null;

  let lastUserText = null;
  let prevAssistantQid = null;
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    if (m.role === "user" && lastUserText === null) {
      lastUserText = (m.text || "").trim();
      continue;
    }
    if (m.role === "assistant" && lastUserText !== null) {
      if (m.qid) {
        prevAssistantQid = m.qid;
      } else {
        prevAssistantQid = detectQidFromText(m.text, condition);
      }
      break;
    }
  }

  if (prevAssistantQid && lastUserText && NON_COMMITTAL_RE.test(lastUserText)) {
    // Don't falsely fire on a valid chip answer. Some questions (e.g.,
    // BPH followup-snoring, cv-q1-stairs) offer "Not sure" as a legitimate
    // chip option. If the patient tapped that chip, we shouldn't treat it
    // as a rephrase signal — they gave a real answer; the AI is on the
    // next question, not rephrasing the previous.
    const prevEntry = getRegistryEntry(prevAssistantQid, condition);
    const prevChips = prevEntry?.chips || [];
    const normalized = lastUserText.toLowerCase().replace(/[.!?,]+$/, "").trim();
    const wasValidChip = prevChips.some((c) => {
      // Chip text as-sent: letter prefix stripped for scored chips.
      const stripped = c.replace(/^[a-g]\)\s*/i, "").toLowerCase();
      return stripped === normalized;
    });
    if (wasValidChip) return null;

    return prevEntry;
  }
  return null;
}

// Confirm field regex — matches "Age: 58", "**Age:** 58", "**Age**: 58", etc.
const CONFIRM_FIELD_RE = /^\*{0,2}([A-Za-z][A-Za-z\s]*?)\*{0,2}:\*{0,2}\s*(.+)$/;
const CONFIRM_KNOWN_LABELS = ["age", "allergies", "medications", "medical history", "surgeries", "surgery", "medical hx"];

function parseConfirmFields(messageText) {
  const lines = messageText.split("\n");
  const fields = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(CONFIRM_FIELD_RE);
    if (match) {
      const label = match[1].trim();
      const value = match[2].trim();
      if (CONFIRM_KNOWN_LABELS.some(k => label.toLowerCase().includes(k))) {
        fields.push({ label, value });
      }
    }
  }
  return fields;
}

// getDisplayText — strips content from the AI message before display in the
// chat bubble. Two rules:
//   1. Confirm panel (intake-confirm): strip "Label: Value" lines that are
//      rendered inside the ConfirmPanel so they don't show twice.
//   2. Scored layout (SHIM questions): strip the a) / b) / c) / ... option
//      lines since the ResponseCard renders them as scored chip cards.
// All other keyword-based stripping is gone — that logic belonged to the old
// stacked CV / safety gate panels which no longer exist.
function getDisplayText(msg, condition, messages, index) {
  if (msg.role !== "assistant") return msg.text;
  // Only ED and BPH have registry-driven stripping; other conditions pass through.
  if (condition !== "ed" && condition !== "bph" && condition !== "mh") return msg.text;
  const entry = resolveEntry(msg, messages, index, condition);

  if (entry?.type === "confirm-panel") {
    return msg.text.split("\n").filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      const match = trimmed.match(CONFIRM_FIELD_RE);
      if (!match) return true;
      const label = match[1].trim().toLowerCase();
      return !CONFIRM_KNOWN_LABELS.some(k => label.includes(k));
    }).join("\n");
  }

  if (entry?.layout === "scored") {
    // Scored questions use a-e (ED SHIM), a-f (BPH IPSS Q1-7), or a-g (BPH IPSS Q8 QoL).
    return msg.text.split("\n").filter(line => !line.trim().match(/^[a-g]\)\s+/)).join("\n");
  }

  return msg.text;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function AskDrFleshner() {
  const [step, setStep] = useState("welcome"); // welcome | upload | waiting | chat | soap
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [rawFileText, setRawFileText] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [detectedCondition, setDetectedCondition] = useState(null);
  const [waitingStep, setWaitingStep] = useState(0);
  const [soapNote, setSoapNote] = useState("");
  const [soapLoading, setSoapLoading] = useState(false);
  // Session lifecycle: terminal signal in last AI message → sessionEnded
  // flips true. SOAP generation auto-triggers in the background; patient
  // stays on the chat view and sees a Session Complete Card with a
  // Download Visit Summary button. Chat input is disabled.
  const [sessionEnded, setSessionEnded] = useState(false);
  const [soapAutoTriggered, setSoapAutoTriggered] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [clinicalState, setClinicalState] = useState(null);
  // Initialize to `false` (matches server-render). The post-mount effect
  // below flips it to true on desktop. Avoids the hydration mismatch that
  // fired four React errors (#418/#423/#425) on every page load.
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState("scenario"); // "file" | "scenario" | "build"
  // userMode is "patient" (the original flow — file upload, build, scenarios)
  // or "tester" (a clinician/reviewer evaluating the tool — scenarios + build only,
  // no file upload, with their own identity tracked across runs).
  // null until the user picks on the welcome screen.
  const [userMode, setUserMode] = useState(null);
  const [testerRole, setTesterRole] = useState("");
  // Stable id for this tester across sessions in this browser. Set when
  // the tester finishes the welcome form. By-name match means refreshing
  // the browser will re-show the welcome screen, but the same name will
  // resolve back to the same testerId server-side (Phase 2).
  const [testerId, setTesterId] = useState(null);
  const [completedScenarios, setCompletedScenarios] = useState([]);
  // Active session id for the current scenario run. Set when launchChat
  // calls /api/sessions/start; used by the session-end watcher to mark
  // the session complete in KV.
  const [currentSessionId, setCurrentSessionId] = useState(null);
  // Demo simulation state: schedule modal + which booking actions have
  // been confirmed. None of this is real — the residents see a fake
  // calendar, fake confirmations, and a fake email card. The intent is
  // for the demo to feel end-to-end without depending on real backend
  // services we haven't built (calendar API, pharmacy network, mailer).
  const [scheduleModal, setScheduleModal] = useState({ open: false, action: null });
  const [pharmacySent, setPharmacySent] = useState(false);
  // bookings: list of confirmed appointments. Rendered as inline cards
  // in the chat log so the resident sees the "I just booked something"
  // moment as part of the conversation, not as a disconnected toast.
  const [bookings, setBookings] = useState([]);
  const [buildCondition, setBuildCondition] = useState("bph");
  const [buildForm, setBuildForm] = useState({});
  const [aiGenerating, setAiGenerating] = useState(false);
  const [customScenarios, setCustomScenarios] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  // ── UI Panel State (ED only) ──
  const [panelStates, setPanelStates] = useState({}); // { [msgIndex]: { submitted, responses } }
  const [conversationId] = useState(() => `consult-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const scenarioFileRef = useRef(null);
  const initialContextRef = useRef("");

  // Responsive breakpoint hook. Both isMobile and dashboardOpen start at
  // their server-render-safe defaults (false) so hydration matches; the
  // first post-mount run reconciles to the real viewport. Only the first
  // mount opens the dashboard on desktop — subsequent resizes don't, so
  // we don't override the user's manual close.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    if (window.innerWidth >= 768) setDashboardOpen(true);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Guard against accidental refresh / tab-close during an active
  // consultation. There's no server-side persistence — refresh wipes
  // everything — so a confirmation prompt is the only safety net.
  // The browser shows its own generic "leave site?" dialog; the string
  // we set is ignored by modern Chrome/Safari but the prompt still fires.
  useEffect(() => {
    const inActiveConsult =
      step === "chat" && !sessionEnded && messages.length > 1;
    if (!inActiveConsult) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = ""; // required for Chrome
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, sessionEnded, messages.length]);

  // ═══════════════════════════════════════════════════════════════════════
  // UI PANEL SYSTEM — ED Only (from ED_Desktop_Style_Guide.jsx)
  // ═══════════════════════════════════════════════════════════════════════

  const T = {
    bg: "#f7f8fa", surface: "#ffffff", text: "#1a1e2c",
    textSecondary: "#5a6175", textMuted: "#8f95a8",
    border: "#e4e7ee", borderLight: "#eef0f4",
    accent: "#0f7b6c", accentSoft: "#e6f5f2", accentMid: "#c3e8e1",
    accentHover: "#0a695c", accentText: "#0b6358",
    chipBg: "#ffffff", chipBorder: "#d4d8e1", chipHoverBg: "#f4f6f9",
    chipActiveBg: "#e6f5f2", chipActiveBorder: "#0f7b6c", chipActiveText: "#0b6358",
    chipRadius: "22px",
    panelBg: "#fafbfc", panelBorder: "#e4e7ee", panelRadius: "14px",
    confirmCorrect: "#0f7b6c", confirmFlag: "#d97706", confirmFlagBg: "#fffbeb",
    yesGreen: "#0f7b6c", noBorder: "#d4d8e1",
    componentIndent: 52, bubbleMax: "82%",
    font: "'Söhne', -apple-system, 'Segoe UI', system-ui, sans-serif",
    fontSize: 15, fontSmall: 13, fontTiny: 11, lineHeight: 1.6,
  };

  const handlePanelSubmit = (messageIndex, responseText) => {
    // Guard against double-fire: if the previous turn is still in flight,
    // ignore the chip tap. Without this, tapping a chip then immediately
    // typing + Enter could fire two sendToAPI calls in parallel.
    if (isLoading) return;
    setPanelStates((prev) => ({
      ...prev,
      [messageIndex]: { submitted: true, response: responseText },
    }));
    setTimeout(() => {
      sendToAPI(messages, responseText, true, true);
    }, 300);
  };

  // Rule 5: Patient answer = full chat bubble (not a tiny pill)
  // After tapping, the response card disappears and the patient's answer
  // shows as a normal patient bubble on the right. Handled by NOT skipping
  // isComponentSubmission messages in the render loop.

  // ── COMPONENT 1: ConfirmPanel (from ED_Desktop_Style_Guide.jsx) ──
  function ConfirmPanel({ fields, messageIndex }) {
    const state = panelStates[messageIndex];
    if (state?.submitted) return null;

    // Store responses in panelStates (persists across re-renders)
    // instead of local useState (resets when component remounts)
    const responses = state?.responses || {};
    const setResponse = (idx, value) => {
      setPanelStates((prev) => ({
        ...prev,
        [messageIndex]: { ...prev[messageIndex], responses: { ...(prev[messageIndex]?.responses || {}), [idx]: value } },
      }));
    };

    const allAnswered = Object.keys(responses).length === fields.length;

    const handleSubmit = () => {
      const flagged = fields.filter((_, i) => responses[i] === "flag");
      if (flagged.length === 0) {
        handlePanelSubmit(messageIndex, "All confirmed ✓");
      } else {
        handlePanelSubmit(messageIndex, "FLAGGED: " + flagged.map((f) => f.label).join(", "));
      }
    };

    return (
      <div style={{
        marginLeft: T.componentIndent, marginBottom: 4, maxWidth: T.bubbleMax,
        background: T.panelBg, border: `1.5px solid ${T.panelBorder}`,
        borderRadius: T.panelRadius, overflow: "hidden", fontFamily: T.font,
      }}>
        <div style={{
          padding: "10px 18px", borderBottom: `1px solid ${T.borderLight}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5A6.5 6.5 0 1014.5 8 6.5 6.5 0 008 1.5z" stroke={T.accent} strokeWidth="1.5"/>
            <path d="M5.5 8l2 2 3.5-3.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            fontSize: T.fontTiny, fontWeight: 700, color: T.accent,
            textTransform: "uppercase", letterSpacing: "1px",
          }}>Confirm your information</span>
        </div>
        {fields.map((f, i) => {
          const isFlagged = responses[i] === "flag";
          const isConfirmed = responses[i] === "ok";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", padding: "12px 18px",
              borderBottom: i < fields.length - 1 ? `1px solid ${T.borderLight}` : "none",
              background: isFlagged ? T.confirmFlagBg : "transparent",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: T.fontTiny, fontWeight: 600, color: T.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>{f.label}</div>
                <div style={{
                  fontSize: T.fontSize, color: T.text, marginTop: 2,
                }}>{f.value}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => setResponse(i, "ok")} aria-pressed={isConfirmed} aria-label={`Mark ${f.label} as correct`} style={{
                  padding: "10px 18px", minHeight: 44, borderRadius: 8, fontSize: T.fontSmall,
                  fontWeight: 600, fontFamily: T.font, cursor: "pointer",
                  border: `1.5px solid ${isConfirmed ? T.confirmCorrect : T.chipBorder}`,
                  background: isConfirmed ? T.accentSoft : T.surface,
                  color: isConfirmed ? T.confirmCorrect : T.textSecondary,
                  transition: "all 0.15s ease",
                }}>{isConfirmed ? "✓ Correct" : "Correct"}</button>
                <button type="button" onClick={() => setResponse(i, "flag")} aria-pressed={isFlagged} aria-label={`Flag ${f.label} as incorrect`} style={{
                  padding: "10px 18px", minHeight: 44, borderRadius: 8, fontSize: T.fontSmall,
                  fontWeight: 600, fontFamily: T.font, cursor: "pointer",
                  border: `1.5px solid ${isFlagged ? T.confirmFlag : T.chipBorder}`,
                  background: isFlagged ? T.confirmFlagBg : T.surface,
                  color: isFlagged ? T.confirmFlag : T.textSecondary,
                  transition: "all 0.15s ease",
                }}>{isFlagged ? "⚑ Flagged" : "Flag"}</button>
              </div>
            </div>
          );
        })}
        {allAnswered && (
          <div style={{
            padding: "12px 18px", borderTop: `1px solid ${T.borderLight}`,
            display: "flex", justifyContent: "flex-end",
          }}>
            <button type="button" onClick={handleSubmit} style={{
              padding: "12px 28px", minHeight: 44, borderRadius: 10, border: "none",
              background: T.accent, color: "#fff", fontSize: T.fontSmall,
              fontWeight: 600, fontFamily: T.font, cursor: "pointer",
              boxShadow: "0 2px 4px rgba(15,123,108,0.2)",
            }}>Submit</button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO SIMULATIONS
  // ═══════════════════════════════════════════════════════════════════
  // The product talks about scheduling appointments, sending prescriptions
  // to a pharmacy, and emailing follow-ups — but the production backend
  // for those services doesn't exist yet. For the resident demo we
  // simulate the visible parts so the experience feels end-to-end.
  // Every simulated card carries a small "(simulated)" hint so the
  // tester knows what's real vs scaffolded.

  // Generate three plausible appointment slots starting tomorrow.
  function generateFakeSlots() {
    const slots = [];
    const now = new Date();
    let added = 0;
    let dayOffset = 1;
    const times = [
      { h: 9, m: 30 },
      { h: 14, m: 0 },
      { h: 11, m: 0 },
      { h: 15, m: 30 },
    ];
    while (added < 3 && dayOffset < 14) {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      // Skip Sunday (0) and Saturday (6) for in-person feel.
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const t = times[added % times.length];
        d.setHours(t.h, t.m, 0, 0);
        slots.push(d);
        added++;
      }
      dayOffset++;
    }
    return slots;
  }

  function fmtSlot(d) {
    const day = d.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
    return `${day} · ${time}`;
  }

  // ── SCHEDULE MODAL ──
  function ScheduleModal() {
    const [picked, setPicked] = useState(null);
    const slots = generateFakeSlots();
    if (!scheduleModal.open) return null;
    const action = scheduleModal.action || "Appointment";

    const onConfirm = () => {
      if (!picked) return;
      const slotDate = slots[picked];
      setBookings((prev) => [
        ...prev,
        {
          id: `bk-${Date.now()}`,
          action,
          when: slotDate.getTime(),
          messageCount: messages.length, // anchor card after the current last message
        },
      ]);
      setScheduleModal({ open: false, action: null });
    };

    return (
      <div
        role="dialog"
        aria-label={`Schedule ${action}`}
        aria-modal="true"
        style={{
          position: "fixed", inset: 0, background: "rgba(15, 28, 25, 0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, zIndex: 1000,
        }}
        onClick={() => setScheduleModal({ open: false, action: null })}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff", borderRadius: 14, padding: "22px 24px 18px",
            maxWidth: 440, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.18)",
            fontFamily: "-apple-system, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <h3 style={{ fontSize: 18, color: "#1F2937", margin: 0, fontFamily: "'Georgia', serif" }}>
              Schedule {action}
            </h3>
            <span style={{ fontSize: 10, color: "#506D65", textTransform: "uppercase", letterSpacing: 0.5 }}>(simulated)</span>
          </div>
          <p style={{ fontSize: 13, color: "#506D65", margin: "0 0 14px" }}>
            Available with Dr. Neil Fleshner
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {slots.map((slot, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(i)}
                aria-pressed={picked === i}
                style={{
                  textAlign: "left", padding: "12px 14px", minHeight: 44,
                  borderRadius: 10, fontSize: 14,
                  border: picked === i ? "2px solid #1A6B5B" : "1.5px solid #D8F0EA",
                  background: picked === i ? "#E8F3EF" : "#fff",
                  color: "#1F2937", fontWeight: picked === i ? 600 : 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {picked === i && <span aria-hidden="true" style={{ marginRight: 8, color: "#1A6B5B" }}>✓</span>}
                {fmtSlot(slot)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setScheduleModal({ open: false, action: null })}
              style={{
                padding: "10px 16px", minHeight: 44, borderRadius: 8,
                border: "1.5px solid #D8F0EA", background: "#fff", color: "#506D65",
                fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={picked === null}
              style={{
                padding: "10px 18px", minHeight: 44, borderRadius: 8,
                border: "none", background: "#1A6B5B", color: "#fff",
                fontWeight: 600, fontSize: 13,
                cursor: picked === null ? "not-allowed" : "pointer",
                opacity: picked === null ? 0.5 : 1, fontFamily: "inherit",
              }}
            >Confirm booking</button>
          </div>
        </div>
      </div>
    );
  }

  // Inline confirmation card rendered in the chat log.
  function SystemCard({ icon, title, children, hint }) {
    return (
      <div style={{
        marginLeft: 48, maxWidth: "80%", marginBottom: 8,
        background: "#F5FBF9", border: "1px solid #B8DCD0",
        borderRadius: 12, padding: "12px 14px",
        fontFamily: "-apple-system, 'Segoe UI', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A6B5B" }}>{title}</span>
          {hint && <span style={{ fontSize: 10, color: "#506D65", textTransform: "uppercase", letterSpacing: 0.5, marginLeft: "auto" }}>{hint}</span>}
        </div>
        <div style={{ fontSize: 13, color: "#1F2937", lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    );
  }

  // ── RESPONSE CARD: Single contained component for ALL question types ──
  // ResponseCard: chips only, no text field. Contained card with border + shadow.
  // The main chat input at the bottom is always available as an escape hatch.
  // Removing the text field prevents patients from going off-script with
  // free-form answers that break the clinical flow.
  function ResponseCard({ chips, scored, messageIndex }) {
    const state = panelStates[messageIndex];
    if (state?.submitted) return null;

    const handleChipTap = (chip) => {
      // Strip letter prefix (a-g) — ED SHIM uses a-e, BPH IPSS uses a-f or a-g.
      const cleanLabel = chip.replace(/^[a-g]\)\s*/i, "");
      handlePanelSubmit(messageIndex, cleanLabel);
    };

    return (
      <div style={{
        marginLeft: 48, maxWidth: "78%", marginBottom: 6,
        background: T.surface, border: `1.5px solid ${T.border}`,
        borderRadius: 16, padding: scored ? "12px 14px" : "14px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)", fontFamily: T.font,
      }}>
        {/* Horizontal chips */}
        {chips && !scored && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {chips.map((chip, i) => (
              <button key={i} type="button" onClick={() => handleChipTap(chip)} style={{
                padding: "12px 22px", minHeight: 44, borderRadius: 22,
                border: `1.5px solid ${T.chipBorder}`, background: "#fff",
                color: T.text, fontSize: 15, fontWeight: 500, fontFamily: T.font,
                cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                lineHeight: 1.3, transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.target.style.borderColor = T.accent; e.target.style.background = T.accentSoft; }}
              onMouseLeave={(e) => { e.target.style.borderColor = T.chipBorder; e.target.style.background = "#fff"; }}
              >{chip}</button>
            ))}
          </div>
        )}
        {/* Scored vertical cards — ED SHIM (a-e), BPH IPSS (a-f or a-g). */}
        {chips && scored && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {chips.map((chip, i) => {
              const letter = String.fromCharCode(97 + i);
              const cleanLabel = chip.replace(/^[a-g]\)\s*/i, "");
              return (
                <button key={i} type="button" onClick={() => handleChipTap(chip)} aria-label={`Option ${letter.toUpperCase()}: ${cleanLabel}`} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", minHeight: 44, borderRadius: 12,
                  border: `1.5px solid ${T.chipBorder}`, background: "#fff",
                  color: T.text, fontSize: 15, fontWeight: 500, fontFamily: T.font,
                  cursor: "pointer", textAlign: "left",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.accentSoft; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.chipBorder; e.currentTarget.style.background = "#fff"; }}
                >
                  <span aria-hidden="true" style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, background: "#e3e7ec", color: "#5a6175",
                  }}>{letter}</span>
                  {cleanLabel}
                </button>
              );
            })}
          </div>
        )}
        <div style={{
          fontSize: 13, color: "#5a6175", marginTop: 10, textAlign: "center",
          fontFamily: T.font,
        }}>You can also type a response below</div>
      </div>
    );
  }


  // Load saved custom scenarios on mount
  useEffect(() => {
    (async () => {
      try {
        if (window.storage) {
          const result = await window.storage.get("custom-scenarios");
          if (result && result.value) {
            setCustomScenarios(JSON.parse(result.value));
          }
        }
      } catch (e) { /* storage not available or key doesn't exist — start empty */ }
      setStorageReady(true);
    })();
  }, []);

  // Save custom scenarios whenever they change (including deletions)
  useEffect(() => {
    if (!storageReady) return;
    (async () => {
      try {
        if (window.storage) {
          if (customScenarios.length === 0) {
            await window.storage.delete("custom-scenarios");
          } else {
            await window.storage.set("custom-scenarios", JSON.stringify(customScenarios));
          }
        }
      } catch (e) { /* storage not available — silent fail */ }
    })();
  }, [customScenarios, storageReady]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Event delegation for the simulated [Schedule X] buttons inside the
  // chat log. The buttons are rendered via dangerouslySetInnerHTML so
  // we can't bind onClick directly; we listen at the container level
  // and check the data attribute.
  useEffect(() => {
    if (step !== "chat") return;
    const onClick = (e) => {
      const btn = e.target.closest && e.target.closest("[data-schedule-action]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const action = btn.getAttribute("data-schedule-action") || "Appointment";
      setScheduleModal({ open: true, action });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step]);

  // When the AI says it's sending the prescription to the pharmacy,
  // surface a simulated confirmation card. Detection is text-based —
  // matches the verbatim wording from the medication outcome scripts.
  useEffect(() => {
    if (pharmacySent) return;
    if (!messages.length) return;
    const recent = messages.slice(-3).filter(m => m.role === "assistant");
    const hit = recent.some(m => /send (this|it|your prescription) to (your |the )?pharmacy/i.test(m.text || ""));
    if (hit) setPharmacySent(true);
  }, [messages, pharmacySent]);

  // Voice recognition was removed — inconsistent across browsers (broken on
  // Firefox, flaky on iOS Safari) and not core to the demo experience.

  // Waiting room animation
  const waitingSteps = [
    { label: "Verifying patient records", icon: "🔍" },
    { label: "Reviewing test results", icon: "📋" },
    { label: "Preparing your consultation", icon: "💬" },
    { label: "Dr. Fleshner is ready for you", icon: "✓" },
  ];

  useEffect(() => {
    if (step !== "waiting") return;
    if (waitingStep < waitingSteps.length - 1) {
      const timer = setTimeout(() => setWaitingStep((s) => s + 1), 1800);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => launchChat(), 1200);
      return () => clearTimeout(timer);
    }
  }, [step, waitingStep]);

  // ── LIVE CLINICAL ANALYSIS (fires after each assistant message) ──
  useEffect(() => {
    if (step !== "chat" || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    const analyzeConversation = async () => {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "PATIENT" : "CLINICIAN"}: ${m.text}`)
        .join("\n\n");


      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            condition: detectedCondition,
            patientContext: initialContextRef.current,
          }),
        });

        const parsed = await response.json();
        if (parsed && typeof parsed === "object" && !parsed.error) setClinicalState(parsed);
      } catch (err) {
        console.error("Clinical analysis error:", err);
      }
    };

    analyzeConversation();
  }, [messages]);


  // ── SESSION END WATCHER ──
  // When the most recent assistant message contains a terminal signal
  // (Take care / Schedule link / ER handoff / walk-in / in-person referral)
  // we flip sessionEnded true ONCE, then kick off SOAP generation in the
  // background so the Download Visit Summary button becomes active.
  useEffect(() => {
    if (step !== "chat" || sessionEnded) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || !isTerminalMessage(lastAssistant.text)) return;

    setSessionEnded(true);

    // Track scenario completion for tester mode — both in local state
    // (immediate UI update) and in KV (persists across browser restarts).
    if (userMode === "tester" && patientData?.name) {
      const sc = SCENARIO_DB.find(s => s.data.name === patientData.name);
      if (sc) {
        setCompletedScenarios(prev => prev.includes(sc.id) ? prev : [...prev, sc.id]);
      }
      // Mark the KV session record complete. Idempotent — safe if the
      // watcher fires more than once. Best-effort: a KV outage doesn't
      // block the consultation flow.
      if (currentSessionId) {
        fetch("/api/sessions/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            turns: messages.length,
            finalOutcome: lastAssistant.text?.slice(0, 200) || null,
          }),
        }).catch((e) => console.warn("sessions/complete failed:", e));
      }
    }

    // Kick off SOAP generation exactly once, asynchronously.
    if (!soapAutoTriggered) {
      setSoapAutoTriggered(true);
      (async () => {
        try {
          setSoapLoading(true);
          const transcript = messages
            .map((m) => `${m.role === "user" ? "PATIENT" : "DR. FLESHNER"}: ${m.text}`)
            .join("\n\n");
          const response = await fetch("/api/soap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript,
              patientContext: initialContextRef.current,
              condition: detectedCondition,
            }),
          });
          const data = await response.json();
          setSoapNote(data.note || "We couldn't prepare your visit summary right now. Our team has a copy on file — please reach out if you'd like one sent to you.");
        } catch (err) {
          console.error("SOAP generation error:", err);
          setSoapNote("We couldn't prepare your visit summary right now. Our team has a copy on file — please reach out if you'd like one sent to you.");
        } finally {
          setSoapLoading(false);
        }
      })();
    }
  }, [messages, step, sessionEnded, soapAutoTriggered, detectedCondition]);


  // ── WELCOME SCREEN (Landing Page) ──
  if (step === "welcome") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5FBF9" }}>

        {/* ── HEADER ── */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "12px 16px" : "16px 32px",
          background: "#FFFFFF",
          borderBottom: "1px solid #D8F0EA",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={DR_AVATAR} alt="Dr. Fleshner" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #1A6B5B" }} />
            <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </span>
          </div>
          {!isMobile && <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span style={{ fontSize: 14, color: "#506D65" }}>About</span>
            <span style={{ fontSize: 14, color: "#506D65" }}>Contact</span>
          </div>}
        </header>

        {/* ── HERO + FORM ── */}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "24px 16px" : "40px 20px" }}>
          <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>

            <p style={{
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
              color: "#1A6B5B",
              textTransform: "uppercase",
              letterSpacing: 1.5,
              margin: "0 0 12px",
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
            }}>
              Virtual Urology Consultation
            </p>

            <h1 style={{
              fontSize: isMobile ? 28 : 38,
              fontWeight: 700,
              color: "#1F2937",
              margin: "0 0 16px",
              fontFamily: "'Georgia', serif",
              lineHeight: 1.2,
              letterSpacing: -0.5,
            }}>
              Welcome to<br />AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </h1>

            <p style={{
              fontSize: isMobile ? 15 : 17,
              lineHeight: 1.7,
              color: "#4B5563",
              margin: "0 auto 36px",
              maxWidth: 420,
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
            }}>
              A virtual consultation experience with Dr. Neil Fleshner's urology practice.
            </p>

            {/* ── Form Card ── */}
            <div style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: isMobile ? "24px 20px 20px" : "32px 32px 28px",
              textAlign: "left",
              border: "1px solid #D8F0EA",
              boxShadow: "0 2px 16px rgba(26, 107, 91, 0.06)",
            }}>
              {/* STAGE 1 — Mode select. Shown until the user picks. */}
              {userMode === null && (
                <>
                  <p style={{
                    fontSize: 15, fontWeight: 600, color: "#1F2937",
                    margin: "0 0 6px", fontFamily: "-apple-system, 'Segoe UI', sans-serif",
                  }}>
                    How are you using AskDrFleshner today?
                  </p>
                  <p style={{
                    fontSize: 13, color: "#506D65",
                    margin: "0 0 18px", fontFamily: "-apple-system, 'Segoe UI', sans-serif",
                  }}>
                    Pick the option that fits — we'll tailor the experience.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { key: "tester",  title: "I'm here to evaluate the tool",
                        sub: "I'll play through one or more patient scenarios and share feedback." },
                      { key: "patient", title: "I'm a patient",
                        sub: "I'd like a virtual consultation with Dr. Fleshner." },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        aria-label={opt.title}
                        onClick={() => setUserMode(opt.key)}
                        style={{
                          display: "block", textAlign: "left", width: "100%",
                          padding: "14px 16px", borderRadius: 12,
                          border: "1.5px solid #D8F0EA", background: "#FFFFFF",
                          cursor: "pointer", minHeight: 44, fontFamily: "-apple-system, 'Segoe UI', sans-serif",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1A6B5B"; e.currentTarget.style.background = "#F5FBF9"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D8F0EA"; e.currentTarget.style.background = "#FFFFFF"; }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginBottom: 3 }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: 13, color: "#506D65", lineHeight: 1.4 }}>
                          {opt.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* STAGE 2 — Identity form. Same fields for both modes;
                  testers also get an optional role field. */}
              {userMode !== null && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 16px" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", margin: 0, fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
                      {userMode === "tester" ? "Tell us about yourself" : "Enter your details to begin"}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setUserMode(null); setTesterRole(""); }}
                      style={{
                        background: "transparent", border: "none", color: "#1A6B5B",
                        fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4,
                        fontFamily: "-apple-system, 'Segoe UI', sans-serif",
                      }}
                      aria-label="Change selection"
                    >
                      ← Back
                    </button>
                  </div>

                  <div style={styles.formGroup}>
                    <label htmlFor="welcome-first-name" style={styles.label}>First Name</label>
                    <input
                      id="welcome-first-name"
                      style={styles.input}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={userMode === "tester" ? "e.g. Sarah" : "e.g. Michael"}
                      autoComplete="given-name"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label htmlFor="welcome-last-name" style={styles.label}>Last Name</label>
                    <input
                      id="welcome-last-name"
                      style={styles.input}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={userMode === "tester" ? "e.g. Chen" : "e.g. Tran"}
                      autoComplete="family-name"
                    />
                  </div>

                  {userMode === "tester" && (
                    <div style={styles.formGroup}>
                      <label htmlFor="welcome-role" style={styles.label}>Your role <span style={{ color: "#506D65", fontWeight: 400 }}>(optional)</span></label>
                      <select
                        id="welcome-role"
                        style={{ ...styles.input, cursor: "pointer", appearance: "auto" }}
                        value={testerRole}
                        onChange={(e) => setTesterRole(e.target.value)}
                      >
                        <option value="">Select…</option>
                        <option value="urologist">Urologist</option>
                        <option value="gp">Family physician / GP</option>
                        <option value="resident">Resident / fellow</option>
                        <option value="other-clinical">Other clinician</option>
                        <option value="non-clinical">Non-clinical reviewer</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    style={{
                      ...styles.primaryBtn,
                      opacity: firstName && lastName ? 1 : 0.4,
                      cursor: firstName && lastName ? "pointer" : "not-allowed",
                    }}
                    disabled={!firstName || !lastName}
                    onClick={async () => {
                      if (userMode === "tester") {
                        // Upsert by name in Vercel KV. Returns the canonical
                        // testerId (same name = same record) and the list of
                        // scenarios this tester has previously completed so
                        // we can hydrate the "✓ Completed" badges.
                        try {
                          const res = await fetch("/api/testers/upsert", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ firstName, lastName, role: testerRole || null }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setTesterId(data.tester?.id || null);
                            setCompletedScenarios(Array.isArray(data.completedScenarios) ? data.completedScenarios : []);
                          } else {
                            // Don't block the demo on a KV outage — fall back to
                            // a session-local id so the rest of the flow still works.
                            console.warn("testers/upsert failed, using session-local id");
                            setTesterId(`tester-local-${Date.now()}`);
                          }
                        } catch (e) {
                          console.warn("testers/upsert error, using session-local id", e);
                          setTesterId(`tester-local-${Date.now()}`);
                        }
                        // Default to Test Scenarios — the tester happy path.
                        setUploadMode("scenario");
                      }
                      setStep("upload");
                    }}
                  >
                    Start Your Session
                  </button>
                </>
              )}
            </div>

            <p style={{
              fontSize: 13,
              color: "#506D65",
              marginTop: 20,
              lineHeight: 1.5,
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
            }}>
              This is a demonstration tool for educational purposes only. Not for clinical use.
            </p>
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: isMobile ? "16px" : "28px 32px",
          background: "#FFFFFF",
          borderTop: "1px solid #D8F0EA",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </span>
            
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <span style={{ fontSize: 13, color: "#506D65" }}>Privacy Policy</span>
            <span style={{ fontSize: 13, color: "#506D65" }}>Terms of Use</span>
            <span style={{ fontSize: 13, color: "#506D65" }}>Accessibility</span>
          </div>
          <div style={{ fontSize: 13, color: "#506D65" }}>
            © {new Date().getFullYear()} Dr. Neil Fleshner. All rights reserved.
          </div>
        </footer>
      </div>
    );
  }

  // ── UPLOAD & VALIDATE SCREEN ──
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      console.error("Failed to read file:", reader.error);
    };
    reader.onload = async (ev) => {
      const text = ev.target.result;
      setRawFileText(text);
      const parsed = parsePatientFile(text);
      setPatientData(parsed);

      // Detect condition server-side to keep classification logic hidden
      try {
        const res = await fetch("/api/detect-condition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referralReason: parsed.referralReason,
            medicalHistory: parsed.medicalHistory?.join(" "),
          }),
        });
        const { condition } = await res.json();
        setDetectedCondition(condition);
      } catch {
        setDetectedCondition("unknown");
      }

      setFileUploaded(true);
    };
    reader.readAsText(file);
  };

  // Select a pre-built scenario — condition is hardcoded in scenario data
  const selectScenario = (scenario) => {
    setPatientData(scenario.data);
    setDetectedCondition(scenario.condition);
    setFileUploaded(true);
  };

  // Upload a .txt file and add it to the scenario database
  const handleScenarioUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      console.error("Failed to read scenario file:", reader.error);
    };
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const parsed = parsePatientFile(text);
      let condition = "unknown";
      try {
        const res = await fetch("/api/detect-condition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referralReason: parsed.referralReason,
            medicalHistory: parsed.medicalHistory?.join(" "),
          }),
        });
        const result = await res.json();
        condition = result.condition;
      } catch { /* fallback to unknown */ }
      const newScenario = {
        id: `custom-${Date.now()}`,
        condition: condition,
        label: "Custom Upload",
        summary: `${parsed.age || "?"}${parsed.sex?.[0] || ""}, ${parsed.referralReason?.slice(0, 60) || file.name}${(parsed.referralReason?.length ?? 0) > 60 ? "..." : ""}`,
        data: parsed,
        custom: true,
      };
      setCustomScenarios(prev => [...prev, newScenario]);
      // Auto-select the newly uploaded scenario
      setPatientData(parsed);
      setDetectedCondition(condition);
      setFileUploaded(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Build-your-own: update a single form field
  const updateBuildField = (key, value) => {
    setBuildForm(prev => ({ ...prev, [key]: value }));
  };

  // Build-your-own: apply form data as patientData
  const applyBuildForm = async () => {
    const f = buildForm;
    const data = {
      name: f.name || "", age: f.age || "", sex: f.sex || "", mrn: f.mrn || "",
      pcp: f.pcp || "", referralReason: f.referralReason || "",
      allergies: f.allergies || "None known",
      medicalHistory: f.medicalHistory ? f.medicalHistory.split(",").map(s => s.trim()).filter(Boolean) : [],
      surgicalHistory: f.surgicalHistory ? f.surgicalHistory.split(",").map(s => s.trim()).filter(Boolean) : [],
      medications: f.medications ? f.medications.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    // Condition-specific fields
    if (buildCondition === "bph") {
      data.psa = f.psa || ""; data.freePsa = f.freePsa || ""; data.ua = f.ua || "";
      data.prostateVolume = f.prostateVolume || ""; data.pvr = f.pvr || "";
      data.creatinine = f.creatinine || ""; data.egfr = f.egfr || "";
    } else if (buildCondition === "ed") {
      data.testosterone = f.testosterone || ""; data.fastingGlucose = f.fastingGlucose || "";
      data.hba1c = f.hba1c || ""; data.lipids = f.lipids || "";
      data.priorEdTreatment = f.priorEdTreatment || ""; data.psa = f.psa || "";
      data.edDuration = f.edDuration || ""; data.edSeverity = f.edSeverity || "";
    } else if (buildCondition === "mh") {
      data.rbcHpf = f.rbcHpf || ""; data.uaMethod = f.uaMethod || "";
      data.dipstick = f.dipstick || ""; data.proteinuria = f.proteinuria || "";
      data.urineCulture = f.urineCulture || ""; data.creatinine = f.creatinine || "";
      data.egfr = f.egfr || ""; data.priorImaging = f.priorImaging || "";
    }
    setPatientData(data);
    // Condition is hardcoded from the user's selection
    setDetectedCondition(buildCondition);
    setFileUploaded(true);
  };

  // AI auto-generate a realistic patient for the selected condition
  const aiGeneratePatient = async () => {
    setAiGenerating(true);
    try {
      const condLabel = buildCondition === "bph" ? "BPH/LUTS" : buildCondition === "ed" ? "Erectile Dysfunction" : "Microhematuria";
      const resp = await fetch("/api/generate-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: buildCondition, conditionLabel: condLabel }),
      });
      const parsed = await resp.json();
      if (parsed && !parsed.error) setBuildForm(parsed);
    } catch (err) {
      console.error("AI generate error:", err);
    }
    setAiGenerating(false);
  };

  const startChat = () => {
    setWaitingStep(0);
    setStep("waiting");
  };

  const launchChat = () => {
    setStep("chat");

    // Tester mode — record session start in KV so the admin view and the
    // "Completed" badges have something to read. Best-effort: if KV is
    // unreachable we still proceed, the consultation just won't be logged.
    if (userMode === "tester" && testerId) {
      const scenarioId = SCENARIO_DB.find(s => s.data.name === patientData?.name)?.id || null;
      fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testerId, scenarioId, condition: detectedCondition }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.session?.id) setCurrentSessionId(d.session.id); })
        .catch((e) => console.warn("sessions/start failed:", e));
    }

    // Build condition-specific patient context
    const d = patientData;
    const name = d.name || `${firstName} ${lastName}`;

    // Common fields for all conditions
    let context = `PATIENT REFERRAL DATA:
- Name: ${name}
- Age: ${d.age || "Unknown"}
- Sex: ${d.sex || "Unknown"}
- MRN: ${d.mrn || "Unknown"}
- Primary Care Physician: ${d.pcp || "Unknown"}
- Referral Reason: ${d.referralReason || "Not specified"}
- Medical History: ${d.medicalHistory?.join(", ") || "None listed"}
- Surgical History: ${d.surgicalHistory?.join(", ") || "None listed"}
- Allergies: ${d.allergies || "None known"}
- Medications: ${d.medications?.join(", ") || "None listed"}`;

    // Condition-specific fields
    if (detectedCondition === "bph") {
      context += `
- PSA: ${d.psa || "Not available"}
- Free/Total PSA: ${d.freePsa || "Not available"}
- Urinalysis: ${d.ua || "Not available"}
- Creatinine: ${d.creatinine || "Not available"}
- eGFR: ${d.egfr || "Not available"}
- Prostate Volume: ${d.prostateVolume || "Not available"}
- Post-void Residual: ${d.pvr || "Not available"}`;
    } else if (detectedCondition === "ed") {
      context += `
- Testosterone: ${d.testosterone || "Not available"}
- Fasting Glucose: ${d.fastingGlucose || "Not available"}
- HbA1C: ${d.hba1c || "Not available"}
- Lipids: ${d.lipids || "Not available"}
- PSA: ${d.psa || "Not available"}
- Prior ED Treatments: ${d.priorEdTreatment || "None documented"}
- ED Duration: ${d.edDuration || "Not specified"}
- ED Severity: ${d.edSeverity || "Not specified"}`;
    } else if (detectedCondition === "mh") {
      context += `
- Urinalysis RBC/HPF: ${d.rbcHpf || "Not available"}
- UA Method: ${d.uaMethod || "Not specified"}
- Dipstick Blood: ${d.dipstick || "Not available"}
- Proteinuria: ${d.proteinuria || "Not noted"}
- Urine Culture: ${d.urineCulture || "Not available"}
- Serum Creatinine: ${d.creatinine || "Not available"}
- eGFR: ${d.egfr || "Not available"}
- Prior Imaging: ${d.priorImaging || "None documented"}`;
    } else {
      // Unknown — send everything we have
      context += `
- PSA: ${d.psa || "Not available"}
- Urinalysis: ${d.ua || "Not available"}
- Creatinine: ${d.creatinine || "Not available"}
- Testosterone: ${d.testosterone || "Not available"}`;
    }

    context += `\n\nBEGIN the consultation now. Review the patient data above and deliver your opening message. The patient's first name is ${firstName}.`;

    initialContextRef.current = context;
    sendToAPI([], context, false);
  };

  if (step === "upload") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5FBF9" }}>
        {/* ── HEADER ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "12px 16px" : "16px 32px", background: "#FFFFFF", borderBottom: "1px solid #D8F0EA",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setStep("welcome")}>
            <img src={DR_AVATAR} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #1A6B5B" }} />
            <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
              AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
            </span>
          </div>
          <button type="button" style={styles.backBtn} onClick={() => setStep("welcome")}>{isMobile ? "← Back" : "← Back to Home"}</button>
        </header>

        {/* ── CONTENT ── */}
        <main style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: isMobile ? "16px 12px" : "32px 20px", overflowY: "auto" }}>
        <div style={{ ...styles.uploadCard, maxWidth: 640, padding: isMobile ? "20px 16px" : "36px 40px" }}>
          <div style={styles.uploadHeader}>
            <h2 style={styles.uploadTitle}>Patient Setup</h2>
            <p style={styles.uploadSubtitle}>
              Hi {firstName}, choose how you'd like to load patient information for this consultation.
            </p>
          </div>

          {/* ── MODE TABS ── */}
          {/* Testers don't see the Upload File tab — it's not part of the
              demo-evaluation flow and the file format isn't documented for
              external users. Patients keep the full three-tab choice. */}
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderRadius: 10, overflow: "hidden", border: "1.5px solid #D8F0EA" }}>
            {[
              { key: "scenario", label: "Test Scenarios" },
              userMode === "tester" ? null : { key: "file", label: "Upload File" },
              { key: "build", label: "Build Your Own" },
            ].filter(Boolean).map(tab => (
              <button
                type="button"
                key={tab.key}
                aria-pressed={uploadMode === tab.key}
                onClick={() => { setUploadMode(tab.key); setPatientData(null); setFileUploaded(false); }}
                style={{
                  flex: 1, padding: "12px 8px", border: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: uploadMode === tab.key ? 700 : 600, fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  background: uploadMode === tab.key ? "#1A6B5B" : "#FFFFFF",
                  color: uploadMode === tab.key ? "#FFFFFF" : "#506D65",
                  borderBottom: uploadMode === tab.key ? "3px solid #0E4B3F" : "3px solid transparent",
                  transition: "all 0.2s",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {uploadMode === tab.key && <span aria-hidden="true">✓</span>}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ════════════════════ MODE: SCENARIOS ════════════════════ */}
          {uploadMode === "scenario" && (
            <div>
              <p style={{ fontSize: 14, color: "#506D65", margin: "0 0 16px", lineHeight: 1.5 }}>
                {userMode === "tester"
                  ? "Pick a patient scenario to play through. Each one tests a different clinical decision branch."
                  : "Select a pre-built patient record to test the consultation, or upload your own referral file to add it to the library."}
              </p>
              {/* Upload to add scenario — hidden in tester mode (testers
                  go through Build Your Own if they want a custom case). */}
              {userMode !== "tester" && (
              <div
                onClick={() => scenarioFileRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                  border: "1.5px dashed #3D5D80", background: "#FFFFFF",
                  marginBottom: 20, transition: "all 0.2s",
                }}
              >
                <input
                  ref={scenarioFileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleScenarioUpload}
                  style={{ display: "none" }}
                />
                <span style={{ fontSize: 16, opacity: 0.6 }}>📄</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#3D5D80", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                  Upload a referral file to add to scenarios
                </span>
              </div>
              )}
              {/* Custom uploads section (if any) */}
              {customScenarios.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                    color: "#1A6B5B", marginBottom: 8, fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    Your Uploads
                    <span style={{
                      fontSize: 10, background: "#1A6B5B", color: "#fff", padding: "2px 7px",
                      borderRadius: 10, fontWeight: 600, letterSpacing: 0,
                    }}>{customScenarios.length}</span>
                  </div>
                  {customScenarios.map(sc => {
                    const isSelected = patientData && patientData.name === sc.data.name && patientData.mrn === sc.data.mrn;
                    return (
                      <div
                        key={sc.id}
                        onClick={() => selectScenario(sc)}
                        style={{
                          padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                          border: isSelected ? "2px solid #1A6B5B" : "1.5px solid #D8F0EA",
                          background: isSelected ? "rgba(26, 107, 91, 0.06)" : "#FFFFFF",
                          marginBottom: 8, transition: "all 0.2s", position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>{sc.data.name || "Unknown Patient"}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              fontSize: 10, background: "#EEF3F8", color: "#3D5D80", padding: "2px 8px",
                              borderRadius: 8, fontWeight: 600, textTransform: "uppercase",
                            }}>{sc.condition === "unknown" ? "Unclassified" : sc.condition.toUpperCase()}</span>
                            {isSelected && <span style={{ fontSize: 13, color: "#1A6B5B", fontWeight: 600 }}>Selected ✓</span>}
                            <button
                              type="button"
                              aria-label={`Delete scenario ${sc.name || ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomScenarios(prev => prev.filter(s => s.id !== sc.id));
                                if (isSelected) { setPatientData(null); setFileUploaded(false); }
                              }}
                              style={{
                                width: 22, height: 22, borderRadius: "50%", border: "none",
                                background: "transparent", color: "#9ca3af", cursor: "pointer",
                                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.15s",
                              }}
                              title="Remove scenario"
                            >×</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "#506D65", marginTop: 2 }}>{sc.summary}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Built-in scenarios by condition */}
              {["bph", "ed", "mh"].map(cond => {
                const scenarios = SCENARIO_DB.filter(s => s.condition === cond);
                if (!scenarios.length) return null;
                return (
                  <div key={cond} style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                      color: "#3D5D80", marginBottom: 8, fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    }}>
                      {CONDITION_LABELS[cond]}
                    </div>
                    {scenarios.map(sc => {
                      const isSelected = patientData && patientData.name === sc.data.name;
                      // "Already completed" badge — only relevant in tester mode.
                      // Phase 2 will hydrate completedScenarios from the KV store.
                      const completed = userMode === "tester" && completedScenarios.includes(sc.id);
                      return (
                        <div
                          key={sc.id}
                          onClick={() => selectScenario(sc)}
                          style={{
                            padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                            border: isSelected ? "2px solid #1A6B5B" : "1.5px solid #D8F0EA",
                            background: isSelected ? "rgba(26, 107, 91, 0.06)" : "#FFFFFF",
                            marginBottom: 8, transition: "all 0.2s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>{sc.data.name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {completed && (
                                <span aria-label="You've completed this scenario before" style={{
                                  fontSize: 11, color: "#1A6B5B", background: "#E8F3EF",
                                  padding: "3px 8px", borderRadius: 8, fontWeight: 600,
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                }}>
                                  <span aria-hidden="true">✓</span> Completed
                                </span>
                              )}
                              {isSelected && <span style={{ fontSize: 13, color: "#1A6B5B", fontWeight: 600 }}>Selected ✓</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: "#1A6B5B", fontWeight: 600, marginTop: 2 }}>{sc.label}</div>
                          <div style={{ fontSize: 13, color: "#506D65", marginTop: 2 }}>{sc.summary}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* ════════════════════ MODE: FILE UPLOAD ════════════════════ */}
          {uploadMode === "file" && (
            <div>
              <p style={{ fontSize: 14, color: "#506D65", margin: "0 0 16px", lineHeight: 1.5 }}>
                Upload a patient referral file (.txt). The system will parse and validate the clinical data automatically.
              </p>
              <div
                style={{
                  ...styles.dropZone,
                  borderColor: fileUploaded ? "#1A6B5B" : "#D8F0EA",
                  background: fileUploaded ? "rgba(26, 107, 91, 0.06)" : "#F5FBF9",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                {fileUploaded ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                    <p style={{ color: "#1A6B5B", fontWeight: 600, margin: 0, fontSize: 16 }}>File uploaded successfully</p>
                    <p style={{ color: "#4B5563", fontSize: 13, margin: "4px 0 0" }}>Click to replace</p>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>📄</div>
                    <p style={{ color: "#374151", fontWeight: 500, margin: 0, fontSize: 16 }}>Click to upload your referral file</p>
                    <p style={{ color: "#506D65", fontSize: 14, margin: "4px 0 0" }}>.txt files accepted</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════ MODE: BUILD YOUR OWN ════════════════════ */}
          {uploadMode === "build" && (
            <div>
              {/* Condition selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={styles.label}>Condition</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["bph", "ed", "mh"].map(c => (
                    <button
                      type="button"
                      key={c}
                      aria-pressed={buildCondition === c}
                      onClick={() => { setBuildCondition(c); setBuildForm({}); setPatientData(null); setFileUploaded(false); }}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                        fontSize: 13, fontWeight: 600, fontFamily: "'Helvetica Neue', Arial, sans-serif",
                        border: buildCondition === c ? "2px solid #1A6B5B" : "1.5px solid #D8F0EA",
                        background: buildCondition === c ? "rgba(26, 107, 91, 0.06)" : "#FFFFFF",
                        color: buildCondition === c ? "#1A6B5B" : "#506D65",
                      }}
                    >
                      {c === "bph" ? "BPH" : c === "ed" ? "ED" : "Microhematuria"}
                    </button>
                  ))}
                </div>
              </div>
              {/* AI Generate button */}
              <button
                type="button"
                onClick={aiGeneratePatient}
                disabled={aiGenerating}
                style={{
                  width: "100%", padding: "12px 0", marginBottom: 20, borderRadius: 10,
                  border: "1.5px solid #3D5D80", background: aiGenerating ? "#EEF3F8" : "#FFFFFF",
                  color: "#3D5D80", fontSize: 14, fontWeight: 600, cursor: aiGenerating ? "wait" : "pointer",
                  fontFamily: "'Helvetica Neue', Arial, sans-serif", transition: "all 0.2s",
                }}
              >
                {aiGenerating ? "Generating patient..." : "✦ AI Generate — Auto-fill a realistic patient"}
              </button>
              {/* Form fields — common */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px 16px", marginBottom: 16 }}>
                {[
                  { key: "name", label: "Patient Name", full: false, placeholder: "e.g. John Smith" },
                  { key: "age", label: "Age", full: false, placeholder: "e.g. 61" },
                  { key: "sex", label: "Sex", full: false, placeholder: "Male / Female" },
                  { key: "mrn", label: "MRN", full: false, placeholder: "e.g. UHN-2024-44891" },
                  { key: "pcp", label: "Referring Physician", full: true, placeholder: "e.g. Dr. Anita Deshpande" },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                    <label style={{ ...styles.label, fontSize: 11, marginBottom: 4 }}>{f.label}</label>
                    <input
                      style={{ ...styles.input, fontSize: 14, padding: "9px 12px" }}
                      value={buildForm[f.key] || ""}
                      onChange={e => updateBuildField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>
              {/* Referral reason — full width textarea */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...styles.label, fontSize: 11, marginBottom: 4 }}>Referral Reason</label>
                <textarea
                  style={{ ...styles.input, fontSize: 14, padding: "9px 12px", minHeight: 60, resize: "vertical" }}
                  value={buildForm.referralReason || ""}
                  onChange={e => updateBuildField("referralReason", e.target.value)}
                  placeholder="Describe the reason for referral..."
                />
              </div>
              {/* Common clinical fields */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px 16px", marginBottom: 16 }}>
                {[
                  { key: "allergies", label: "Allergies", placeholder: "None known" },
                  { key: "medications", label: "Medications (comma-separated)", placeholder: "e.g. Ramipril, Rosuvastatin" },
                  { key: "medicalHistory", label: "Medical History (comma-separated)", placeholder: "e.g. Hypertension, Diabetes" },
                  { key: "surgicalHistory", label: "Surgical History (comma-separated)", placeholder: "e.g. Appendectomy" },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: "1 / -1" }}>
                    <label style={{ ...styles.label, fontSize: 11, marginBottom: 4 }}>{f.label}</label>
                    <input
                      style={{ ...styles.input, fontSize: 14, padding: "9px 12px" }}
                      value={buildForm[f.key] || ""}
                      onChange={e => updateBuildField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>
              {/* Condition-specific fields */}
              <div style={{
                padding: "16px", background: "#F5FBF9", borderRadius: 10, border: "1px solid #D8F0EA", marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#1A6B5B", marginBottom: 12 }}>
                  {buildCondition === "bph" ? "BPH-Specific Fields" : buildCondition === "ed" ? "ED-Specific Fields" : "MH-Specific Fields"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px 16px" }}>
                  {(buildCondition === "bph" ? [
                    { key: "psa", label: "PSA", placeholder: "e.g. 1.2 ng/mL" },
                    { key: "freePsa", label: "Free/Total PSA", placeholder: "e.g. 0.28" },
                    { key: "ua", label: "Urinalysis", placeholder: "e.g. Normal" },
                    { key: "prostateVolume", label: "Prostate Volume", placeholder: "e.g. 35cc" },
                    { key: "pvr", label: "PVR", placeholder: "e.g. 75 mL" },
                    { key: "creatinine", label: "Creatinine", placeholder: "e.g. 88 µmol/L" },
                    { key: "egfr", label: "eGFR", placeholder: "e.g. 82 mL/min" },
                  ] : buildCondition === "ed" ? [
                    { key: "testosterone", label: "Testosterone", placeholder: "e.g. 14.2 nmol/L" },
                    { key: "fastingGlucose", label: "Fasting Glucose", placeholder: "e.g. 6.1 mmol/L" },
                    { key: "hba1c", label: "HbA1C", placeholder: "e.g. 6.3%" },
                    { key: "lipids", label: "Lipids", placeholder: "e.g. LDL 3.4 mmol/L" },
                    { key: "priorEdTreatment", label: "Prior ED Treatment", placeholder: "e.g. None" },
                    { key: "psa", label: "PSA", placeholder: "e.g. 1.8 ng/mL" },
                    { key: "edDuration", label: "ED Duration", placeholder: "e.g. 18 months" },
                    { key: "edSeverity", label: "ED Severity", placeholder: "e.g. Moderate" },
                  ] : [
                    { key: "rbcHpf", label: "RBC/HPF", placeholder: "e.g. 18 RBC/HPF" },
                    { key: "uaMethod", label: "UA Method", placeholder: "e.g. Microscopy" },
                    { key: "dipstick", label: "Dipstick", placeholder: "e.g. 2+ blood" },
                    { key: "proteinuria", label: "Proteinuria", placeholder: "e.g. Negative" },
                    { key: "urineCulture", label: "Urine Culture", placeholder: "e.g. No growth" },
                    { key: "creatinine", label: "Creatinine", placeholder: "e.g. 72 µmol/L" },
                    { key: "egfr", label: "eGFR", placeholder: "e.g. 78 mL/min" },
                    { key: "priorImaging", label: "Prior Imaging", placeholder: "e.g. None" },
                  ]).map(f => (
                    <div key={f.key}>
                      <label style={{ ...styles.label, fontSize: 10, marginBottom: 3, color: "#506D65" }}>{f.label}</label>
                      <input
                        style={{ ...styles.input, fontSize: 13, padding: "8px 10px" }}
                        value={buildForm[f.key] || ""}
                        onChange={e => updateBuildField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Apply button */}
              <button
                type="button"
                onClick={applyBuildForm}
                disabled={!buildForm.name || !buildForm.age}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10,
                  border: "none", background: buildForm.name && buildForm.age ? "#1A6B5B" : "#D8F0EA",
                  color: buildForm.name && buildForm.age ? "#FFFFFF" : "#506D65",
                  fontSize: 14, fontWeight: 600, cursor: buildForm.name && buildForm.age ? "pointer" : "not-allowed",
                  fontFamily: "'Helvetica Neue', Arial, sans-serif", transition: "all 0.2s",
                }}
              >
                Load Patient Data
              </button>
            </div>
          )}

          {/* ════════════════════ VALIDATION PANEL (all modes) ════════════════════ */}
          {patientData && (
            <div style={styles.validationPanel}>
              <h3 style={styles.validationTitle}>Patient Information Verified</h3>
              {detectedCondition && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: detectedCondition === "unknown" ? "#EEF3F8" : "rgba(26, 107, 91, 0.06)",
                  border: `1px solid ${detectedCondition === "unknown" ? "#3D5D80" : "#1A6B5B"}`,
                  borderRadius: 8,
                  marginBottom: 14,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: detectedCondition === "unknown" ? "#3D5D80" : "#1A6B5B",
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  }}>
                    Condition
                  </span>
                  {uploadMode !== "build" ? (
                    <select
                      value={detectedCondition}
                      onChange={(e) => setDetectedCondition(e.target.value)}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1F2937",
                        fontFamily: "'Helvetica Neue', Arial, sans-serif",
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1.5px solid #D8F0EA",
                        background: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <option value="bph">{CONDITION_LABELS.bph}</option>
                      <option value="ed">{CONDITION_LABELS.ed}</option>
                      <option value="mh">{CONDITION_LABELS.mh}</option>
                      <option value="unknown">{CONDITION_LABELS.unknown}</option>
                    </select>
                  ) : (
                    <span style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#1F2937",
                      fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    }}>
                      {CONDITION_LABELS[detectedCondition]}
                    </span>
                  )}
                </div>
              )}

              <div style={{ ...styles.validationGrid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
                {/* Common fields for all conditions */}
                <ValidationItem label="Patient" value={patientData.name} />
                <ValidationItem label="Age" value={patientData.age} />
                <ValidationItem label="Sex" value={patientData.sex} />
                <ValidationItem label="MRN" value={patientData.mrn} />
                <ValidationItem label="PCP" value={patientData.pcp} />
                <ValidationItem label="Allergies" value={patientData.allergies} />
                {/* BPH-specific fields */}
                {detectedCondition === "bph" && <div style={{ display: "contents" }}>
                  <ValidationItem label="PSA" value={patientData.psa} />
                  <ValidationItem label="Free/Total PSA" value={patientData.freePsa} />
                  <ValidationItem label="Urinalysis" value={patientData.ua} />
                  <ValidationItem label="Prostate Vol." value={patientData.prostateVolume} />
                  <ValidationItem label="PVR" value={patientData.pvr} />
                  <ValidationItem label="Creatinine" value={patientData.creatinine} />
                  <ValidationItem label="eGFR" value={patientData.egfr} />
                </div>}
                {/* ED-specific fields */}
                {detectedCondition === "ed" && <div style={{ display: "contents" }}>
                  <ValidationItem label="Testosterone" value={patientData.testosterone} />
                  <ValidationItem label="Fasting Glucose" value={patientData.fastingGlucose} />
                  <ValidationItem label="HbA1C" value={patientData.hba1c} />
                  <ValidationItem label="Lipids" value={patientData.lipids} />
                  <ValidationItem label="Prior ED Tx" value={patientData.priorEdTreatment} />
                  <ValidationItem label="PSA" value={patientData.psa} />
                  <ValidationItem label="ED Duration" value={patientData.edDuration} />
                  <ValidationItem label="ED Severity" value={patientData.edSeverity} />
                </div>}
                {/* MH-specific fields */}
                {detectedCondition === "mh" && <div style={{ display: "contents" }}>
                  <ValidationItem label="RBC/HPF" value={patientData.rbcHpf} />
                  <ValidationItem label="UA Method" value={patientData.uaMethod} />
                  <ValidationItem label="Dipstick" value={patientData.dipstick} />
                  <ValidationItem label="Proteinuria" value={patientData.proteinuria} />
                  <ValidationItem label="Urine Culture" value={patientData.urineCulture} />
                  <ValidationItem label="Creatinine" value={patientData.creatinine} />
                  <ValidationItem label="eGFR" value={patientData.egfr} />
                  <ValidationItem label="Prior Imaging" value={patientData.priorImaging} />
                </div>}
                {/* Unknown - show everything we have */}
                {detectedCondition === "unknown" && <div style={{ display: "contents" }}>
                  <ValidationItem label="PSA" value={patientData.psa} />
                  <ValidationItem label="Urinalysis" value={patientData.ua} />
                  <ValidationItem label="Creatinine" value={patientData.creatinine} />
                </div>}
              </div>

              {patientData.referralReason && (
                <div style={styles.referralBox}>
                  <span style={styles.referralLabel}>Referral Reason</span>
                  <p style={styles.referralText}>{patientData.referralReason}</p>
                </div>
              )}

              {patientData.medications?.length > 0 && (
                <div style={styles.medsBox}>
                  <span style={styles.referralLabel}>Current Medications</span>
                  <p style={styles.referralText}>{patientData.medications.join(" · ")}</p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            style={{
              ...styles.primaryBtn,
              opacity: patientData ? 1 : 0.4,
              cursor: patientData ? "pointer" : "not-allowed",
              marginTop: 16,
            }}
            disabled={!patientData}
            onClick={startChat}
          >
            Begin Virtual Consultation
          </button>
        </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: isMobile ? "16px" : "24px 32px", background: "#FFFFFF", borderTop: "1px solid #D8F0EA",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
            AskDr<span style={{ color: "#3D5D80" }}>Fleshner</span>
          </span>
          <span style={{ fontSize: 13, color: "#506D65" }}>© {new Date().getFullYear()} Dr. Neil Fleshner</span>
        </footer>
      </div>
    );
  }

  // ── WAITING ROOM SCREEN ──
  if (step === "waiting") {
    return (
      <div style={styles.pageContainer}>
        <div style={{ ...styles.waitingCard, padding: isMobile ? "36px 20px" : "56px 40px" }}>
          <div style={styles.waitingAvatarWrap}>
            <img src={DR_AVATAR} alt="Dr. Fleshner" style={styles.waitingAvatar} />
            <div style={{
              ...styles.waitingPulse,
              animation: "waitPulse 2s ease-in-out infinite",
            }} />
          </div>

          <h2 style={styles.waitingTitle}>Virtual Waiting Room</h2>
          <p style={styles.waitingSubtitle}>
            Please hold — your {CONDITION_LABELS[detectedCondition] || "urology"} consultation will begin shortly.
          </p>

          <div style={styles.waitingSteps}>
            {waitingSteps.map((ws, i) => (
              <div
                key={i}
                style={{
                  ...styles.waitingStepRow,
                  opacity: i <= waitingStep ? 1 : 0.25,
                  transform: i <= waitingStep ? "translateX(0)" : "translateX(8px)",
                  transition: "all 0.5s ease",
                }}
              >
                <span style={{
                  ...styles.waitingStepIcon,
                  background: i < waitingStep ? "#1A6B5B" : i === waitingStep ? "#fff" : "#F5FBF9",
                  color: i < waitingStep ? "#fff" : i === waitingStep ? "#1A6B5B" : "#D8F0EA",
                  border: i === waitingStep ? "2px solid #1A6B5B" : "2px solid transparent",
                }}>
                  {i < waitingStep ? "✓" : ws.icon}
                </span>
                <span style={{
                  ...styles.waitingStepLabel,
                  color: i <= waitingStep ? "#1F2937" : "#3F5851",
                  fontWeight: i === waitingStep ? 600 : 400,
                }}>
                  {ws.label}
                </span>
              </div>
            ))}
          </div>

          <div style={styles.waitingProgressTrack}>
            <div style={{
              ...styles.waitingProgressFill,
              width: `${((waitingStep + 1) / waitingSteps.length) * 100}%`,
              transition: "width 0.8s ease",
            }} />
          </div>
        </div>
      </div>
    );
  }

  // ── CHAT SCREEN ──
  async function sendToAPI(history, userMessage, showUserMsg = true, isComponentSubmission = false) {
    setIsLoading(true);

    // Show user message immediately (except for the initial context message)
    if (showUserMsg) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: userMessage, time: new Date(), isComponentSubmission },
      ]);
    }
    
    // Build API messages — always start with patient context
    const contextMsg = initialContextRef.current
      ? [{ role: "user", content: initialContextRef.current }]
      : [];

    const historyMsgs = history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));

    // For initial call, context IS the user message. For subsequent, prepend it.
    const apiMessages = showUserMsg
      ? [...contextMsg, ...historyMsgs, { role: "user", content: userMessage }]
      : [{ role: "user", content: userMessage }];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          condition: detectedCondition || "unknown",
          conversationId,
          patientInfo: patientData,
        }),
      });

      const data = await response.json();
      const assistantRaw = data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "I'm sorry, I had trouble processing that. Could you try again?";

      // Parse the hidden <!-- qid:X --> marker (ED consultations only).
      // Non-ED conversations won't have markers; qid is null in that case.
      const { cleanText, qid } = parseQID(assistantRaw);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: cleanText, qid, time: new Date() },
      ]);
    } catch (err) {
      console.error("API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          time: new Date(),
        },
      ]);
    }

    setIsLoading(false);
  }


  // ── DOWNLOAD VISIT SUMMARY ──
  // Produces a Rich Text Format (.rtf) file the patient can double-click
  // to open in Word, Pages, Google Docs, or any phone reader. No npm
  // dependency needed — RTF is a string-built format and is supported
  // universally. Can upgrade to true .docx (via the `docx` package)
  // later if we want finer control over styling.
  const downloadVisitSummary = () => {
    if (!soapNote) return;
    const patientName = patientData?.name || `${firstName} ${lastName}`.trim() || "Patient";
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const conditionLabel = CONDITION_LABELS[detectedCondition] || "Urology";
    const prettyDate = new Date().toLocaleDateString("en-CA");

    // RTF needs escaping for \, {, } — plus any non-ASCII character
    // becomes \uNNNN? using a signed 16-bit code point.
    const rtfEscape = (s) => {
      if (!s) return "";
      let out = "";
      for (const ch of s) {
        if (ch === "\\" || ch === "{" || ch === "}") {
          out += "\\" + ch;
        } else if (ch === "\n") {
          out += "\\line ";
        } else {
          const code = ch.codePointAt(0);
          if (code < 128) {
            out += ch;
          } else {
            const signed = code > 32767 ? code - 65536 : code;
            out += "\\u" + signed + "?";
          }
        }
      }
      return out;
    };

    // Turn the SOAP note (plain text) into RTF body content.
    // Heading lines like "S (Subjective):" → bold, larger font.
    // Lines starting with "- " → indented bullet paragraph.
    // Blank lines → paragraph break.
    // Other lines → regular paragraph.
    const bodyLines = soapNote.split("\n");
    const bodyRtf = bodyLines.map((raw) => {
      const line = raw.trim();
      if (!line) return "\\par ";
      const isHeading = /^[SOAP]\s*\([A-Za-z]/i.test(line) || /^[A-Z][A-Z\s]+:$/.test(line);
      if (isHeading) {
        return "\\par\\fs26\\b " + rtfEscape(line) + "\\b0\\fs22\\par ";
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        const content = line.replace(/^[-•]\s+/, "");
        return "\\li360\\fi-200\\bullet\\tab " + rtfEscape(content) + "\\li0\\fi0\\par ";
      }
      return rtfEscape(line) + "\\par ";
    }).join("");

    const titleRtf =
      "\\fs36\\b " + rtfEscape("AskDrFleshner — Visit Summary") + "\\b0\\fs22\\par\\par " +
      "\\b " + rtfEscape("Patient:") + "\\b0  " + rtfEscape(patientName) + "\\par " +
      "\\b " + rtfEscape("Date:") + "\\b0  " + rtfEscape(prettyDate) + "\\par " +
      "\\b " + rtfEscape("Consultation:") + "\\b0  " + rtfEscape(conditionLabel) + "\\par\\par " +
      "\\brdrb\\brdrs\\brdrw10 \\par ";

    // Calibri 11pt (\fs22 in RTF half-points).
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252\\deff0 " +
      "{\\fonttbl{\\f0\\fswiss Calibri;}}" +
      "\\f0\\fs22 " +
      titleRtf +
      bodyRtf +
      "}";

    const safeName = patientName.replace(/[^a-zA-Z0-9-]+/g, "_");
    const filename = `AskDrFleshner_Visit_Summary_${safeName}_${dateStr}.rtf`;

    const blob = new Blob([rtf], { type: "application/rtf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput("");
    sendToAPI(messages, userText);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── SOAP NOTE GENERATION ──
  const endConsultation = async () => {
    setSoapLoading(true);
    setStep("soap");

    const conversationLog = messages
      .map((m) => `${m.role === "user" ? "PATIENT" : "DR. FLESHNER"}: ${m.text}`)
      .join("\n\n");

    try {
      const response = await fetch("/api/soap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: conversationLog,
          patientContext: initialContextRef.current,
          condition: detectedCondition,
        }),
      });

      const data = await response.json();
      // Patient-facing copy. The auto-trigger path (around L1061) uses the
      // same wording — keep them in sync. "SOAP note" is internal jargon;
      // patients see "visit summary".
      setSoapNote(data.note || "We couldn't prepare your visit summary right now. Our team has a copy on file — please reach out if you'd like one sent to you.");
    } catch (err) {
      console.error("SOAP generation error:", err);
      setSoapNote("We couldn't prepare your visit summary right now. Our team has a copy on file — please reach out if you'd like one sent to you.");
    }

    setSoapLoading(false);
  };

  // ── EMAIL SOAP NOTE ──
  const sendSoapEmail = async () => {
    if (!doctorEmail.trim()) return;
    setEmailSending(true);

    const patientName = patientData?.name || `${firstName} ${lastName}`;
    const subject = `SOAP Note — Virtual Consultation — ${patientName}`;
    const body = `Dr. Fleshner,\n\nPlease find the SOAP note from the virtual BPH consultation with ${patientName} below.\n\n${"═".repeat(60)}\n\n${soapNote}\n\n${"═".repeat(60)}\n\nGenerated by AskDrFleshner Virtual Consultation Platform\nThis is a demonstration — not for clinical use.`;

    try {
      const encodedSubject = encodeURIComponent(subject);
      const emailBody = encodeURIComponent(body);
      window.open(`mailto:${doctorEmail}?subject=${encodedSubject}&body=${emailBody}`, "_blank");
      setEmailSent(true);
    } catch (err) {
      console.error("Email error:", err);
    }

    setEmailSending(false);
  };

  // Filter out the initial context message from display
  const displayMessages = messages;

  // ── SOAP NOTE SCREEN ──
  if (step === "soap") {
    return (
      <div style={styles.pageContainer}>
        <div style={{ ...styles.soapCard, padding: isMobile ? "20px 16px" : "36px 40px" }}>
          <div style={styles.soapHeader}>
            <img src={DR_AVATAR} alt="Dr. Fleshner" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid #1A6B5B" }} />
            <div>
              <h2 style={styles.soapTitle}>Consultation Complete</h2>
              <p style={styles.soapSubtitle}>
                SOAP Note — {patientData?.name || `${firstName} ${lastName}`} · {new Date().toLocaleDateString("en-CA")}
              </p>
            </div>
          </div>

          {soapLoading ? (
            <div style={styles.soapLoadingWrap}>
              <div style={styles.soapSpinner} />
              <p style={{ color: "#4B5563", fontSize: 15, marginTop: 16 }}>
                Generating clinical documentation...
              </p>
            </div>
          ) : (
            <div style={{ display: "contents" }}>
              <div style={styles.soapNoteBox}>
                <pre style={styles.soapNoteText}>{soapNote}</pre>
              </div>

              <div style={styles.soapEmailSection}>
                <h3 style={styles.soapEmailTitle}>Send to Physician</h3>

                {emailSent ? (
                  <div style={styles.soapSentBanner}>
                    <span style={{ fontSize: 20 }}>✓</span>
                    <span>SOAP note sent to {doctorEmail}</span>
                  </div>
                ) : (
                  <div style={{ display: "contents" }}>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        value={doctorEmail}
                        onChange={(e) => setDoctorEmail(e.target.value)}
                        placeholder="doctor@email.com"
                        type="email"
                      />
                      <button
                        type="button"
                        aria-label="Send SOAP note to physician"
                        style={{
                          ...styles.primaryBtn,
                          width: "auto",
                          padding: "12px 24px",
                          marginTop: 0,
                          opacity: doctorEmail.trim() && !emailSending ? 1 : 0.4,
                        }}
                        onClick={sendSoapEmail}
                        disabled={!doctorEmail.trim() || emailSending}
                      >
                        {emailSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                    <p style={{ fontSize: 14, color: "#506D65", margin: "8px 0 0" }}>
                      The SOAP note will be emailed to the physician for review.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                style={{
                  ...styles.backBtn,
                  marginTop: 20,
                  fontSize: 13,
                  color: "#1A6B5B",
                textDecoration: "none",
                }}
                onClick={() => setStep("chat")}
              >
                ← Back to Conversation
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F5FBF9" }}>
      <h1 className="sr-only">Virtual Consultation with Dr. Neil Fleshner</h1>
      <ScheduleModal />
      {/* Header */}
      <div style={{ ...styles.chatHeader, padding: isMobile ? "10px 12px" : "14px 20px", gap: isMobile ? 8 : 12 }}>
        <img src={DR_AVATAR} alt="Dr. Fleshner" style={{ ...styles.chatAvatar, width: isMobile ? 36 : 44, height: isMobile ? 36 : 44 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ ...styles.chatHeaderName, fontSize: isMobile ? 14 : 16 }}>Dr. Neil Fleshner</h2>
          <p style={{ ...styles.chatHeaderStatus, fontSize: isMobile ? 11 : 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isLoading ? "Typing..." : `${CONDITION_LABELS[detectedCondition] || "Virtual Consultation"}`}
          </p>
        </div>
        {/* Tester-mode role chip — sits in the header so the evaluator
            always knows which patient identity they're voicing. Hidden in
            patient mode (no role split). Truncates on mobile. */}
        {userMode === "tester" && patientData?.name && (
          <div
            aria-label={`Demo session — ${firstName} ${lastName} playing ${patientData.name}`}
            style={{
              fontSize: isMobile ? 10 : 12,
              color: "#1A6B5B",
              background: "#E8F3EF",
              border: "1px solid #B8DCD0",
              borderRadius: 999,
              padding: isMobile ? "4px 8px" : "5px 12px",
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: isMobile ? 140 : 280,
            }}
            title={`${firstName} ${lastName} → playing ${patientData.name}`}
          >
            {isMobile
              ? `→ ${patientData.name.split(" ")[0]}`
              : `${firstName} → playing ${patientData.name}`}
          </div>
        )}
        <button
          type="button"
          aria-label={dashboardOpen ? "Hide patient dashboard" : "Show patient dashboard"}
          aria-expanded={dashboardOpen}
          style={{
            ...styles.endConsultBtn,
            background: "transparent",
            border: "1.5px solid #506D65",
            color: "#506D65",
            marginRight: isMobile ? 4 : 8,
            padding: isMobile ? "8px 12px" : "10px 14px",
            minHeight: 44,
            fontSize: isMobile ? 12 : 13,
          }}
          onClick={() => setDashboardOpen(!dashboardOpen)}
        >
          {isMobile ? (dashboardOpen ? "✕" : "📊") : (dashboardOpen ? "Hide" : "Show") + " Dashboard"}
        </button>
        {messages.length >= 2 && (
          <button type="button" aria-label="End consultation and generate visit summary" style={{ ...styles.endConsultBtn, padding: isMobile ? "8px 12px" : "10px 14px", minHeight: 44, fontSize: isMobile ? 12 : 13 }} onClick={endConsultation} disabled={isLoading}>
            {isMobile ? "End" : "End & Generate SOAP"}
          </button>
        )}
      </div>

      {/* Main area: Chat + Dashboard */}
      <main role="main" aria-label="Consultation" style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={styles.chatMessages} role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation with Dr. Fleshner">
            {displayMessages.length === 0 && !isLoading && (
              <div style={styles.chatWelcomeMsg}>
                <p style={{ margin: 0, color: "#506D65", fontSize: 17 }}>Starting your consultation...</p>
              </div>
            )}
            {displayMessages.map((msg, i) => {
              // Skip panel-submitted messages — shown as SubmittedChip instead
              // Rule 5: Patient answers show as full chat bubbles — don't skip them

              return (
                <div key={i}>
                  <div style={{ ...styles.messageBubbleRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    {msg.role === "assistant" && <img src={DR_AVATAR} alt="" style={styles.msgAvatar} />}
                    <div style={{ ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble), maxWidth: isMobile ? "90%" : "75%" }}>
                      <div style={styles.bubbleText} dangerouslySetInnerHTML={{ __html: renderMarkdown(getDisplayText(msg, detectedCondition, displayMessages, i)) }} />
                    </div>
                  </div>
                  {msg.role === "assistant" && !sessionEnded && (detectedCondition === "ed" || detectedCondition === "bph" || detectedCondition === "mh") && (() => {
                    // Registry-driven: look up the AI-supplied qid marker.
                    // Three fallback layers: (1) direct marker, (2) text match
                    // against registry question, (3) contextual — if patient's
                    // last reply was non-committal, reuse previous qid (rephrase).
                    // All layers are scoped by condition so ED and BPH don't
                    // cross-contaminate despite sharing some qid values.
                    const entry = resolveEntry(msg, displayMessages, i, detectedCondition);
                    if (!entry) return null;

                    // confirm-panel → intake confirmation (the ONE stacked exception)
                    if (entry.type === "confirm-panel") {
                      return <ConfirmPanel fields={parseConfirmFields(msg.text)} messageIndex={i} />;
                    }

                    // chips: null → open-text question, no ResponseCard rendered
                    // (patient types in the main chat input at the bottom)
                    if (!entry.chips) return null;

                    return (
                      <ResponseCard
                        chips={entry.chips}
                        scored={entry.layout === "scored"}
                        messageIndex={i}
                      />
                    );
                  })()}
                </div>
              );
            })}
            {isLoading && !sessionEnded && (
              <div style={{ ...styles.messageBubbleRow, justifyContent: "flex-start" }}>
                <img src={DR_AVATAR} alt="" style={styles.msgAvatar} />
                <div style={styles.assistantBubble}>
                  <div style={styles.typingDots}>
                    <span style={{ ...styles.dot, animationDelay: "0s" }}>●</span>
                    <span style={{ ...styles.dot, animationDelay: "0.2s" }}>●</span>
                    <span style={{ ...styles.dot, animationDelay: "0.4s" }}>●</span>
                  </div>
                </div>
              </div>
            )}
            {sessionEnded && (
              <div style={{
                margin: "18px auto 8px",
                maxWidth: 520,
                border: "1.5px solid #0f7b6c",
                background: "#f0faf7",
                borderRadius: 14,
                padding: "18px 22px",
                boxShadow: "0 2px 8px rgba(15,123,108,0.08)",
                fontFamily: "'Söhne', -apple-system, 'Segoe UI', system-ui, sans-serif",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "#0f7b6c", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700,
                  }}>✓</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0b6358" }}>
                    Consultation Complete
                  </div>
                </div>
                <p style={{
                  fontSize: 14, color: "#4B5563", margin: "0 0 14px", lineHeight: 1.5,
                }}>
                  {soapLoading
                    ? "Preparing your visit summary…"
                    : soapNote
                      ? "Your visit summary is ready."
                      : "We couldn't prepare the visit summary. You can still leave the page — we have a copy on file."}
                </p>
                <button
                  type="button"
                  aria-label="Download visit summary"
                  onClick={downloadVisitSummary}
                  disabled={!soapNote || soapLoading}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: soapNote && !soapLoading ? "#0f7b6c" : "#a8c8c1",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: soapNote && !soapLoading ? "pointer" : "not-allowed",
                    boxShadow: "0 2px 4px rgba(15,123,108,0.2)",
                  }}>
                  {soapLoading ? "Preparing…" : "Download Visit Summary"}
                </button>
              </div>
            )}
            {/* ── DEMO SIMULATION CARDS ───────────────────────────────
                Rendered after the message log. They appear in
                conversation order based on when each was triggered
                (booking via the modal, pharmacy via text-detection).
                Each card carries a "(simulated)" hint. */}
            {bookings.map((bk) => (
              <SystemCard key={bk.id} icon="📅" title="Appointment booked" hint="(simulated)">
                <div><strong>Dr. Neil Fleshner — {bk.action}</strong></div>
                <div style={{ marginTop: 2 }}>{fmtSlot(new Date(bk.when))}</div>
                <div style={{ marginTop: 6, color: "#506D65" }}>
                  Confirmation sent to your email. We'll send a reminder 24 hours before.
                </div>
              </SystemCard>
            ))}
            {pharmacySent && (
              <SystemCard icon="💊" title="Prescription sent" hint="(simulated)">
                <div>Your prescription has been sent to your pharmacy of choice.</div>
                <div style={{ marginTop: 6, color: "#506D65" }}>
                  Pickup typically ready in 2–4 hours. The pharmacy will text you when it's ready.
                </div>
              </SystemCard>
            )}
            {sessionEnded && (
              <SystemCard icon="📧" title={`Email from Dr. Neil Fleshner`} hint="(simulated)">
                <div style={{ color: "#506D65", fontSize: 12, marginBottom: 6 }}>
                  To: {patientData?.name || `${firstName} ${lastName}`} &middot; From: Dr. Neil Fleshner &lt;office@askdrfleshner.io&gt;
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Your virtual consultation summary</div>
                <div style={{ lineHeight: 1.55 }}>
                  Thanks for the visit today — it was good to walk through this with you.
                  Your visit summary is attached, along with everything we discussed and
                  any next steps. If anything changes or new symptoms come up before our
                  follow-up, please reach out to the office and we'll get you in sooner.
                  <br /><br />
                  Take care,<br />
                  Dr. Neil Fleshner
                </div>
                <div style={{ marginTop: 8, padding: "6px 10px", border: "1px dashed #B8DCD0", borderRadius: 6, fontSize: 12, color: "#506D65" }}>
                  📎 visit-summary.rtf — attached
                </div>
              </SystemCard>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ ...styles.chatInputArea, padding: isMobile ? "10px 12px 16px" : "12px 16px 20px" }}>
            {/* Patient Progress Bar */}
            {(() => {
              // Progress by registry qid gives granular, monotonic progress
              // that moves with every answered question — much more accurate
              // than the coarse /api/analyze phase labels which lag and jump
              // in big steps. ED and BPH both use registries; MH still uses
              // the analyze phase map.

              const analyzePhaseMap = {
                opening: { pct: 5, label: "Getting started" },
                intake: { pct: 20, label: "Background questions" },
                questionnaire: { pct: 45, label: "Symptom assessment" },
                follow_up: { pct: 70, label: "Almost there" },
                safety_gate: { pct: 85, label: "Final checks" },
                outcome_delivery: { pct: 95, label: "Wrapping up" },
                closed: { pct: 100, label: "Consultation complete" },
              };

              // Detect terminal close signals in the most recent AI message.
              // Uses the shared isTerminalMessage() helper so the progress bar
              // and the session close-out logic agree on what "terminal" means.
              const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
              const isTerminal = isTerminalMessage(lastAssistant?.text);

              let pct = 0;
              let label = "";
              const hasRegistry = detectedCondition === "ed" || detectedCondition === "bph" || detectedCondition === "mh";

              if (isTerminal) {
                pct = 100;
                label = "Consultation complete";
              } else if (hasRegistry) {
                // Walk backwards to find the most recent assistant message with
                // a resolvable qid, then map its registry index to a percentage.
                const activeRegistry = getRegistry(detectedCondition);
                const phaseLabels = PHASE_LABELS_BY_CONDITION[detectedCondition] || {};
                let registryIdx = -1;
                let matchedEntry = null;
                for (let i = messages.length - 1; i >= 0; i--) {
                  const m = messages[i];
                  if (m.role !== "assistant") continue;
                  const entry = resolveEntry(m, messages, i, detectedCondition);
                  if (entry) {
                    registryIdx = activeRegistry.findIndex((e) => e.id === entry.id);
                    matchedEntry = entry;
                    break;
                  }
                }

                if (registryIdx >= 0) {
                  const total = activeRegistry.length;
                  // Scale: first qid = 3%, last = 98%. 100% reserved for terminal.
                  pct = Math.round(3 + (registryIdx / (total - 1)) * 95);
                  label = phaseLabels[matchedEntry.phase] || "In progress";
                } else {
                  // No registry match yet — very first message, or opening.
                  const info = analyzePhaseMap[clinicalState?.phase];
                  pct = info?.pct || (messages.length > 0 ? Math.min(messages.length * 3, 15) : 0);
                  label = info?.label || (messages.length > 0 ? "Getting started" : "");
                }
              } else {
                // MH / unknown: use the /api/analyze phase map.
                const info = analyzePhaseMap[clinicalState?.phase];
                pct = info?.pct || (messages.length > 0 ? Math.min(messages.length * 3, 15) : 0);
                label = info?.label || (messages.length > 0 ? "Getting started" : "");
              }

              return pct > 0 ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#506D65", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 12, color: "#506D65" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "#D8F0EA", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct >= 100 ? "#1A6B5B" : "linear-gradient(90deg, #1A6B5B, #2A8A72)",
                      borderRadius: 2,
                      transition: "width 0.8s ease",
                    }} />
                  </div>
                </div>
              ) : null;
            })()}
            {sessionEnded ? (
              <div style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px dashed #D8F0EA",
                background: "#F5FBF9",
                color: "#506D65",
                fontSize: 14,
                textAlign: "center",
                fontFamily: "'Söhne', -apple-system, 'Segoe UI', system-ui, sans-serif",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <span>
                  {userMode === "tester"
                    ? "This consultation has ended. Try another scenario or end your testing session."
                    : "This consultation has ended. If you need further help, please book a follow-up."}
                </span>
                {userMode === "tester" && (
                  <button
                    type="button"
                    onClick={() => {
                      // Reset all per-consultation state, return to scenario picker.
                      // Tester identity (firstName/lastName/role/testerId) is preserved.
                      setMessages([]);
                      setPatientData(null);
                      setRawFileText("");
                      setDetectedCondition(null);
                      setSessionEnded(false);
                      setSoapAutoTriggered(false);
                      setSoapNote("");
                      setSoapLoading(false);
                      setClinicalState(null);
                      setPanelStates({});
                      setFileUploaded(false);
                      setCurrentSessionId(null);
                      initialContextRef.current = "";
                      setStep("upload");
                    }}
                    style={{
                      padding: "10px 20px", minHeight: 44, borderRadius: 22,
                      background: "#1A6B5B", color: "#fff", border: "none",
                      fontWeight: 600, fontSize: 14, cursor: "pointer",
                      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
                    }}
                  >
                    Try another scenario →
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.inputRow}>
                <label htmlFor="chat-input" className="sr-only">Type your reply to Dr. Fleshner</label>
                <textarea
                  id="chat-input"
                  aria-label="Type your reply to Dr. Fleshner"
                  style={styles.chatInput}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your reply…"
                  rows={1}
                />
                <button
                  type="button"
                  aria-label="Send message"
                  style={{ ...styles.sendBtn, width: 44, height: 44, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <span aria-hidden="true">↑</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CLINICAL DECISION DASHBOARD ═══ */}
        {dashboardOpen && (
          <div style={{
            width: isMobile ? "100%" : 340,
            position: isMobile ? "absolute" : "static",
            top: 0, right: 0, bottom: 0,
            zIndex: isMobile ? 20 : "auto",
            background: "#FFFFFF",
            borderLeft: isMobile ? "none" : "1px solid #D8F0EA",
            boxShadow: isMobile ? "-4px 0 20px rgba(0,0,0,0.12)" : "none",
            overflowY: "auto",
            padding: "20px 16px",
            flexShrink: 0,
            fontFamily: "-apple-system, 'Segoe UI', sans-serif",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Clinical Dashboard
              </h3>
              {/* "DEMO" badge — clarifies this is a simulated dashboard for
                  evaluation, not a production clinical telemetry surface. */}
              <span
                title="Demo dashboard — populated by a synthetic-analysis pass during testing"
                style={{
                  fontSize: 10, fontWeight: 700, color: "#1A6B5B", background: "#E8F3EF",
                  border: "1px solid #B8DCD0", padding: "3px 8px", borderRadius: 4,
                  textTransform: "uppercase", letterSpacing: 0.5,
                }}
              >Demo</span>
            </div>

            {/* Phase Indicator */}
            <DashboardCard title="Consultation Phase">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: clinicalState?.phase === "closed" ? "#506D65" : "#1A6B5B",
                  animation: clinicalState?.phase !== "closed" ? "blink 1.5s infinite" : "none",
                }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>
                  {String(clinicalState?.phaseLabel || "Initializing...")}
                </span>
              </div>
              {clinicalState?.questionsAsked > 0 && (
                <p style={{ fontSize: 13, color: "#506D65", margin: "6px 0 0" }}>
                  {clinicalState.questionsAsked} questions asked
                  {clinicalState.questionsRemaining ? ` · ~${clinicalState.questionsRemaining} remaining` : ""}
                </p>
              )}
            </DashboardCard>

            {/* Severity Score (IPSS/SHIM) */}
            {clinicalState?.scores && typeof clinicalState.scores === "object" && Object.values(clinicalState.scores).some(v => v !== null) && (
              <DashboardCard title={detectedCondition === "ed" ? "SHIM Score" : detectedCondition === "bph" ? "IPSS Score" : "Assessment"}>
                {clinicalState.scores.total !== null && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: "#1F2937", fontFamily: "'Georgia', serif" }}>
                      {clinicalState.scores.total}
                    </span>
                    <span style={{ fontSize: 13, color: "#506D65" }}>
                      / {detectedCondition === "ed" ? "25" : "35"}
                    </span>
                    {clinicalState.severityLabel && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                        background: clinicalState.severity === "severe" ? "#FEE2E2" : clinicalState.severity === "moderate" ? "#FEF3C7" : "#D1FAE5",
                        color: clinicalState.severity === "severe" ? "#991B1B" : clinicalState.severity === "moderate" ? "#92400E" : "#065F46",
                      }}>
                        {String(clinicalState.severityLabel || "")}
                      </span>
                    )}
                  </div>
                )}
                {/* Individual Q scores */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(clinicalState.scores).filter(([k]) => k !== "total").map(([key, val]) => (
                    <div key={key} style={{
                      width: 36, height: 36, borderRadius: 6, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      background: val !== null ? "#1A6B5B" : "#F5FBF9",
                      border: val !== null ? "none" : "1px solid #D8F0EA",
                    }}>
                      <span style={{ fontSize: 8, color: val !== null ? "rgba(255,255,255,0.6)" : "#506D65", textTransform: "uppercase" }}>
                        {key}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: val !== null ? "#FFFFFF" : "#D8F0EA" }}>
                        {val !== null ? String(val) : "–"}
                      </span>
                    </div>
                  ))}
                </div>
              </DashboardCard>
            )}

            {/* Phenotype / Etiology Signals */}
            {clinicalState?.phenotypeSignals && typeof clinicalState.phenotypeSignals === "object" && Object.values(clinicalState.phenotypeSignals).some(a => Array.isArray(a) && a.length > 0) && (
              <DashboardCard title="Clinical Signals">
                {Object.entries(clinicalState.phenotypeSignals).map(([type, signals]) => (
                  signals?.length > 0 && (
                    <div key={type} style={{ marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                        color: type === "obstructive" || type === "organic" ? "#1A6B5B" : type === "storage" || type === "psychogenic" ? "#3D5D80" : "#92400E",
                      }}>{type}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {signals.map((s, i) => (
                          <span key={i} style={{
                            fontSize: 12, padding: "3px 8px", borderRadius: 4,
                            background: "#F5FBF9", border: "1px solid #D8F0EA", color: "#374151",
                          }}>{typeof s === "string" ? s : JSON.stringify(s)}</span>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {clinicalState.phenotype && (
                  <div style={{
                    marginTop: 8, padding: "8px 10px", borderRadius: 6,
                    background: "rgba(26, 107, 91, 0.06)", border: "1px solid #D8F0EA",
                  }}>
                    <span style={{ fontSize: 11, color: "#506D65", textTransform: "uppercase", letterSpacing: 0.5 }}>Pattern: </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>{String(clinicalState.phenotype || "")}</span>
                  </div>
                )}
              </DashboardCard>
            )}

            {/* Risk Factors */}
            {clinicalState?.riskFactors?.length > 0 && (
              <DashboardCard title="Risk Factors">
                {clinicalState.riskFactors.map((rf, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: "#D97706", fontSize: 12 }}>⚠</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{typeof rf === "string" ? rf : JSON.stringify(rf)}</span>
                  </div>
                ))}
              </DashboardCard>
            )}

            {/* Safety Flags */}
            {clinicalState?.safetyFlags?.length > 0 && (
              <DashboardCard title="Safety Flags">
                {clinicalState.safetyFlags.map((sf, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: "#DC2626", fontSize: 12 }}>●</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{typeof sf === "string" ? sf : JSON.stringify(sf)}</span>
                  </div>
                ))}
              </DashboardCard>
            )}

            {/* Eligibility Checklist */}
            {clinicalState?.eligibility && (
              <DashboardCard title="Eligibility Checklist">
                {Object.entries(clinicalState.eligibility).map(([key, val]) => {
                  const labels = {
                    ageOk: "Age within range",
                    labsComplete: "Labs complete",
                    noContraindications: "No contraindications",
                    severityThresholdMet: "Severity threshold",
                    phenotypeEligible: "Phenotype eligible",
                    safetyGatePassed: "Safety gate",
                  };
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 14,
                        color: val === true ? "#1A6B5B" : val === false ? "#DC2626" : "#D8F0EA",
                      }}>
                        {val === true ? "✓" : val === false ? "✗" : "○"}
                      </span>
                      <span style={{ fontSize: 13, color: val === null ? "#506D65" : "#374151" }}>
                        {String(labels[key] || key)}
                      </span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}

            {/* Preliminary Outcome */}
            {clinicalState?.preliminaryOutcome && (
              <DashboardCard title="Preliminary Outcome">
                <div style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: clinicalState.preliminaryOutcome.startsWith("A") ? "#D1FAE5"
                    : clinicalState.preliminaryOutcome.startsWith("B") ? "#DBEAFE"
                    : clinicalState.preliminaryOutcome.startsWith("C") ? "#FEF3C7"
                    : "#F3F4F6",
                  border: "1px solid transparent",
                }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>
                    {String(clinicalState.preliminaryOutcome || "")}
                  </span>
                  {clinicalState.preliminaryOutcomeReason && (
                    <p style={{ fontSize: 12, color: "#506D65", margin: "4px 0 0", lineHeight: 1.5 }}>
                      {String(clinicalState.preliminaryOutcomeReason || "")}
                    </p>
                  )}
                </div>
              </DashboardCard>
            )}

            {/* Key Findings */}
            {clinicalState?.keyFindings?.length > 0 && (
              <DashboardCard title="Key Findings">
                {clinicalState.keyFindings.map((kf, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", lineHeight: 1.5 }}>
                    · {typeof kf === "string" ? kf : JSON.stringify(kf)}
                  </p>
                ))}
              </DashboardCard>
            )}

            {!clinicalState && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#506D65" }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>📊</div>
                <p style={{ fontSize: 13, margin: 0 }}>Dashboard will populate as the consultation progresses</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── VALIDATION ITEM COMPONENT ──
function ValidationItem({ label, value }) {
  const isPresent = value && value !== "Not available" && value !== "null" && value !== "Not done";
  return (
    <div style={styles.validationItem}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: isPresent ? "#1A6B5B" : "#3D5D80", fontSize: 14 }}>
          {isPresent ? "●" : "○"}
        </span>
        <span style={styles.valLabel}>{label}</span>
      </div>
      <span style={styles.valValue}>{value || "—"}</span>
    </div>
  );
}

// ── DASHBOARD CARD COMPONENT ──
function DashboardCard({ title, children }) {
  return (
    <div style={{
      marginBottom: 14,
      padding: "14px 12px",
      background: "#F5FBF9",
      borderRadius: 10,
      border: "1px solid #D8F0EA",
    }}>
      <h4 style={{
        fontSize: 11, fontWeight: 700, color: "#506D65",
        textTransform: "uppercase", letterSpacing: 0.8,
        margin: "0 0 10px",
      }}>{title}</h4>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════
const styles = {
  pageContainer: {
    minHeight: "100vh",
    background: "#F5FBF9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },

  // Welcome
  welcomeCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "48px 40px",
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    border: "1px solid #D8F0EA",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  welcomeAvatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #1A6B5B",
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
    color: "#1F2937",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    letterSpacing: -0.5,
  },
  accentText: { color: "#3D5D80" },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#506D65",
    margin: "2px 0 0",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    fontWeight: 500,
  },
  welcomeDesc: {
    fontSize: 17,
    lineHeight: 1.7,
    color: "#4B5563",
    marginBottom: 28,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  formGroup: { marginBottom: 18 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  input: {
    width: "100%",
    padding: "16px 18px",
    border: "1.5px solid #D8F0EA",
    borderRadius: 12,
    fontSize: 17,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    background: "#FFFFFF",
    color: "#1F2937",
  },
  primaryBtn: {
    width: "100%",
    padding: "18px 0",
    background: "#1A6B5B",
    color: "#F5FBF9",
    border: "none",
    borderRadius: 12,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    transition: "all 0.2s",
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: 13,
    color: "#3F5851",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 1.5,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },

  // Upload
  uploadCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "36px 40px",
    maxWidth: 580,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    border: "1px solid #D8F0EA",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#506D65",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
    marginBottom: 16,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  uploadHeader: { marginBottom: 24 },
  uploadTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 8px",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    letterSpacing: -0.3,
  },
  uploadSubtitle: {
    fontSize: 16,
    color: "#4B5563",
    margin: 0,
    lineHeight: 1.6,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  dropZone: {
    border: "2px dashed #D8F0EA",
    borderRadius: 16,
    padding: "36px 20px",
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#F5FBF9",
  },

  // Validation
  validationPanel: {
    marginTop: 24,
    background: "#F5FBF9",
    borderRadius: 14,
    padding: "22px 18px",
    border: "1px solid #D8F0EA",
  },
  validationTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 14px",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  validationGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px 16px",
  },
  validationItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "6px 0",
  },
  valLabel: {
    fontSize: 13,
    color: "#506D65",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  valValue: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: 500,
    marginLeft: 18,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  referralBox: {
    marginTop: 14,
    padding: "14px 16px",
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #D8F0EA",
  },
  medsBox: {
    marginTop: 10,
    padding: "14px 16px",
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #D8F0EA",
  },
  referralLabel: {
    fontSize: 13,
    color: "#506D65",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  referralText: {
    fontSize: 16,
    color: "#374151",
    margin: "6px 0 0",
    lineHeight: 1.6,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },

  // Waiting Room
  waitingCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "56px 40px",
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    textAlign: "center",
    border: "1px solid #D8F0EA",
  },
  waitingAvatarWrap: {
    position: "relative",
    display: "inline-block",
    marginBottom: 28,
  },
  waitingAvatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #1A6B5B",
    position: "relative",
    zIndex: 1,
  },
  waitingPulse: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: "50%",
    border: "2px solid rgba(26, 107, 91, 0.15)",
    zIndex: 0,
  },
  waitingTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 8px",
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  waitingSubtitle: {
    fontSize: 16,
    color: "#4B5563",
    margin: "0 0 36px",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  waitingSteps: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    textAlign: "left",
    marginBottom: 32,
  },
  waitingStepRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  waitingStepIcon: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    flexShrink: 0,
    transition: "all 0.4s ease",
  },
  waitingStepLabel: {
    fontSize: 17,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    transition: "all 0.4s ease",
  },
  waitingProgressTrack: {
    height: 3,
    background: "#D8F0EA",
    borderRadius: 2,
    overflow: "hidden",
  },
  waitingProgressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #1A6B5B, #2A8A72)",
    borderRadius: 2,
  },

  // Chat
  chatPage: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#F5FBF9",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    background: "#FFFFFF",
    borderBottom: "1px solid #D8F0EA",
    flexShrink: 0,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid #1A6B5B",
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1A6B5B",
    margin: 0,
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  chatHeaderStatus: {
    fontSize: 14,
    color: "#506D65",
    margin: 0,
  },
  endConsultBtn: {
    padding: "10px 16px",
    background: "rgba(91, 127, 165, 0.15)",
    border: "1.5px solid #3D5D80",
    borderRadius: 8,
    color: "#3D5D80",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
    flexShrink: 0,
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 16px",
  },
  chatWelcomeMsg: {
    textAlign: "center",
    padding: "40px 20px",
  },
  messageBubbleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 6,
  },
  msgAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    border: "1.5px solid #0f7b6c",
    marginTop: 2,
  },
  userBubble: {
    background: "#0f7b6c",
    color: "#ffffff",
    padding: "11px 18px",
    borderRadius: "16px 4px 16px 16px",
    maxWidth: "70%",
    fontWeight: 500,
  },
  assistantBubble: {
    background: "#f1f3f7",
    color: "#1a1e2c",
    padding: "13px 18px",
    borderRadius: "4px 16px 16px 16px",
    maxWidth: "78%",
  },
  bubbleText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
  },
  typingDots: {
    display: "flex",
    gap: 4,
    padding: "4px 0",
  },
  dot: {
    fontSize: 10,
    color: "#506D65",
    animation: "blink 1.2s infinite",
  },

  // Input area
  chatInputArea: {
    padding: "12px 16px 24px",
    background: "#FFFFFF",
    borderTop: "1px solid #D8F0EA",
    flexShrink: 0,
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    padding: "14px 18px",
    border: "1.5px solid #D8F0EA",
    borderRadius: 22,
    fontSize: 17,
    outline: "none",
    resize: "none",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    lineHeight: 1.4,
    maxHeight: 120,
    background: "#F5FBF9",
    color: "#1F2937",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "none",
    background: "#1A6B5B",
    color: "#F5FBF9",
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.2s",
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "1.5px solid #D8F0EA",
    background: "#F5FBF9",
    color: "#506D65",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.2s",
  },

  // SOAP Note Screen
  soapCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "36px 40px",
    maxWidth: 660,
    width: "100%",
    boxShadow: "0 2px 32px rgba(26, 107, 91, 0.06)",
    maxHeight: "90vh",
    overflowY: "auto",
    border: "1px solid #D8F0EA",
  },
  soapHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
    paddingBottom: 24,
    borderBottom: "1px solid #D8F0EA",
  },
  soapTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: "#1F2937",
    margin: 0,
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  soapSubtitle: {
    fontSize: 15,
    color: "#506D65",
    margin: "2px 0 0",
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  soapLoadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 0",
  },
  soapSpinner: {
    width: 40,
    height: 40,
    border: "3px solid #D8F0EA",
    borderTopColor: "#1A6B5B",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  soapNoteBox: {
    background: "#F5FBF9",
    border: "1px solid #D8F0EA",
    borderRadius: 12,
    padding: "22px 20px",
    maxHeight: 400,
    overflowY: "auto",
  },
  soapNoteText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#374151",
    fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
  },
  soapEmailSection: {
    marginTop: 28,
    padding: "24px 0 0",
    borderTop: "1px solid #D8F0EA",
  },
  soapEmailTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1F2937",
    margin: "0 0 4px",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
  soapSentBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 18px",
    background: "rgba(26, 107, 91, 0.06)",
    border: "1px solid #1A6B5B",
    borderRadius: 12,
    color: "#1F2937",
    fontWeight: 600,
    fontSize: 16,
    marginTop: 10,
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
  },
}

// Inject keyframes and Google Font
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @keyframes blink {
      0%, 20% { opacity: 0.2; }
      50% { opacity: 1; }
      80%, 100% { opacity: 0.2; }
    }
    @keyframes waitPulse {
      0%, 100% { transform: scale(1); opacity: 0.15; }
      50% { transform: scale(1.18); opacity: 0.4; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes micPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
    }
    input:focus, textarea:focus {
      border-color: #1A6B5B !important;
    }
    button:hover {
      opacity: 0.9;
    }
    ::placeholder {
      color: #9DD4C4;
    }
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #D8F0EA;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(styleEl);
}
