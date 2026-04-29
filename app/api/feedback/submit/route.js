import { saveFeedback } from "../../../../lib/testers-store";

export async function POST(request) {
  try {
    const { sessionId, feedback } = await request.json();
    if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });
    const result = await saveFeedback({ sessionId, feedback });
    return Response.json(result);
  } catch (err) {
    console.error("feedback/submit error:", err);
    return Response.json({ error: err.message || "submit failed" }, { status: 500 });
  }
}
