export async function POST(request) {
  try {
    const { transcript, condition, patientContext } = await request.json();

    const analysisPrompt = `You are a clinical analysis engine. Analyze this virtual urology consultation transcript and return ONLY valid JSON (no markdown, no backticks, no preamble).

PATIENT REFERRAL:
${patientContext}

CONDITION: ${condition}

TRANSCRIPT SO FAR:
${transcript}

Return this exact JSON structure, filling in what you can determine from the conversation so far. Use null for unknown fields:

{
  "phase": "opening|intake|questionnaire|follow_up|safety_gate|outcome_delivery|closed",
  "phaseLabel": "human readable current phase name",
  "questionsAsked": 0,
  "questionsRemaining": null,
  "severity": null,
  "severityLabel": null,
  "scores": {
    "q1": null, "q2": null, "q3": null, "q4": null, "q5": null, "q6": null, "q7": null, "qol": null,
    "total": null
  },
  "phenotype": null,
  "phenotypeSignals": {
    "obstructive": [],
    "storage": [],
    "nocturnalPolyuria": [],
    "psychogenic": [],
    "organic": []
  },
  "riskFactors": [],
  "safetyFlags": [],
  "eligibility": {
    "ageOk": null,
    "labsComplete": null,
    "noContraindications": null,
    "severityThresholdMet": null,
    "phenotypeEligible": null,
    "safetyGatePassed": null
  },
  "preliminaryOutcome": null,
  "preliminaryOutcomeReason": null,
  "keyFindings": [],
  "conversationNotes": null
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        temperature: 0,
        max_tokens: 1000,
        messages: [{ role: "user", content: analysisPrompt }],
      }),
    });

    const data = await response.json();
    const text = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("") || "";

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json(parsed);
  } catch (error) {
    console.error("Analysis API error:", error);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
