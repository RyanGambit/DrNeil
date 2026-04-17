export async function POST(request) {
  try {
    const { transcript, patientContext, condition } = await request.json();

    const soapPrompt = `You are a clinical documentation assistant. Based on the following virtual urology consultation transcript and patient referral data, generate a complete SOAP note.

PATIENT REFERRAL DATA:
${patientContext}

CONDITION: ${condition}

CONSULTATION TRANSCRIPT:
${transcript}

Generate a structured SOAP note with these sections. Use proper clinical language and be thorough:

S (Subjective):
- Chief complaint and HPI
- IPSS score and individual question scores (if administered for BPH)
- SHIM score and individual question scores (if administered for ED)
- Risk stratification (if determined for MH)
- QoL score
- Phenotype/etiology identified
- Symptom timeline and trajectory
- Impact in patient's words
- Treatment preference

O (Objective):
- PSA value and date
- Urinalysis and date
- Imaging findings (prostate volume, PVR)
- Lab results (testosterone, glucose, HbA1C, lipids, creatinine, eGFR as applicable)
- DRE findings if available
- Current medications (confirmed)
- Allergies (confirmed)
- Medication safety gate responses (if asked)
- Cardiovascular risk assessment (if performed)

A (Assessment):
- Clinical impression
- Severity classification (IPSS/SHIM/AUA risk category)
- Phenotype/etiology classification
- Risk stratification
- Eligibility for virtual prescription or investigation

P (Plan):
- Outcome chosen and rationale
- Intervention details (medication, investigations ordered, or monitoring plan)
- Realistic expectations documented
- Follow-up timing
- Safety net documented

Format the output with clear section headers. Be specific and clinical.`;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Haiku 4.5 handles structured summarization well and is ~3-5x
        // faster than Opus for this task. SOAP generation doesn't need
        // Opus-level reasoning — it's a transformation of the transcript
        // into a documented format. Opus was the bottleneck making the
        // Visit Summary hang on "Preparing..." after session close.
        model: "claude-haiku-4-5-20251001",
        temperature: 0.2,
        max_tokens: 1800,
        messages: [{ role: "user", content: soapPrompt }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, response.statusText);
      return Response.json({ error: "AI service unavailable" }, { status: 502 });
    }

    const data = await response.json();
    const noteText = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n") || "Unable to generate SOAP note.";

    return Response.json({ note: noteText });
  } catch (error) {
    console.error("SOAP API error:", error);
    return Response.json({ error: "SOAP generation failed" }, { status: 500 });
  }
}
