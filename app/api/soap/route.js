export async function POST(request) {
  try {
    const { transcript, patientContext, condition } = await request.json();

    const soapPrompt = `You are a clinical documentation assistant. Based on the following virtual urology consultation transcript and patient referral data, generate a complete SOAP note.

PATIENT REFERRAL DATA:
${patientContext}

CONDITION: ${condition}

CONSULTATION TRANSCRIPT:
${transcript}

Generate a structured SOAP note with clear section headers (S, O, A, P). Use proper clinical language and be thorough. Be specific to the condition (${condition}).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        temperature: 0.2,
        max_tokens: 2000,
        messages: [{ role: "user", content: soapPrompt }],
      }),
    });

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
