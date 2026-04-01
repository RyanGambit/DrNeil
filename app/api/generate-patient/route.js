export async function POST(request) {
  try {
    const { condition, conditionLabel } = await request.json();

    const fieldSpec = condition === "bph"
      ? ',"psa":"","freePsa":"","ua":"","prostateVolume":"","pvr":"","creatinine":"","egfr":""'
      : condition === "ed"
      ? ',"testosterone":"","fastingGlucose":"","hba1c":"","lipids":"","priorEdTreatment":"","edDuration":"","edSeverity":"","psa":""'
      : ',"rbcHpf":"","uaMethod":"","dipstick":"","proteinuria":"","urineCulture":"","creatinine":"","egfr":"","priorImaging":""';

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
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Generate a realistic but fictional urology patient referral for ${conditionLabel}. Return ONLY valid JSON (no markdown, no backticks) with these exact keys:
{"name":"","age":"","sex":"","mrn":"","pcp":"","referralReason":"","allergies":"","medicalHistory":"comma-separated","surgicalHistory":"comma-separated","medications":"comma-separated"${fieldSpec}}
Make it clinically realistic. The patient should be between 40-75 years old. Use Canadian medical conventions (units, drug names). Vary the complexity — sometimes straightforward, sometimes with complicating factors. Generate a unique name.`,
        }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, response.statusText);
      return Response.json({ error: "AI service unavailable" }, { status: 502 });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Patient generation JSON parse error:", parseErr, "Raw text:", cleaned.slice(0, 200));
      return Response.json({ error: "Failed to generate valid patient data" }, { status: 502 });
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("Generate patient error:", err);
    return Response.json({ error: "Failed to generate patient" }, { status: 500 });
  }
}
