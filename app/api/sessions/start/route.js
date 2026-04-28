import { startSession } from "../../../../lib/testers-store";

export async function POST(request) {
  try {
    const { testerId, scenarioId, condition } = await request.json();
    if (!testerId) {
      return Response.json({ error: "testerId required" }, { status: 400 });
    }
    const session = await startSession({ testerId, scenarioId, condition });
    return Response.json({ session });
  } catch (err) {
    console.error("sessions/start error:", err);
    return Response.json({ error: err.message || "start failed" }, { status: 500 });
  }
}
