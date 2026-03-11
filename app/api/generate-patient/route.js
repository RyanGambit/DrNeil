export async function POST(request) {
  try {
    const { condition, conditionLabel } = await request.json();

    const fieldSpec = condition === "bph"
      ? ',"psa":"","freePsa":"","ua":"","prostateVolume":"","pvr":"","creatinine":"","egfr":""'
      : condition === "ed"
      ? ',"testosterone":"","fastingGlucose":"","hba1c":"","lipids":"","priorEdTreatment":"","edDuration":"","edSeverity":"","psa":""'
      : ',"rbcHpf":"","uaMethod":"","dipstick":"","proteinuria":"","urineCulture":"","creatinine":"","egfr":"","priorImaging":""';

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

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);
  } catch (err) {
    console.error("Generate patient error:", err);
    return Response.json({ error: "Failed to generate patient" }, { status: 500 });
  }
}
