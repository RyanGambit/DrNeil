import { saveTranscript } from "../../../../lib/testers-store";

export async function POST(request) {
  try {
    const { sessionId, messages } = await request.json();
    if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });
    const result = await saveTranscript({ sessionId, messages });
    return Response.json(result);
  } catch (err) {
    console.error("sessions/transcript error:", err);
    return Response.json({ error: err.message || "save failed" }, { status: 500 });
  }
}
