import { completeSession } from "../../../../lib/testers-store";

export async function POST(request) {
  try {
    const { sessionId, turns, finalOutcome } = await request.json();
    if (!sessionId) {
      return Response.json({ error: "sessionId required" }, { status: 400 });
    }
    const session = await completeSession({ sessionId, turns, finalOutcome });
    return Response.json({ session });
  } catch (err) {
    console.error("sessions/complete error:", err);
    return Response.json({ error: err.message || "complete failed" }, { status: 500 });
  }
}
