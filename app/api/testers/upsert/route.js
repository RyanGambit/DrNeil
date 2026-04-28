import { upsertTester } from "../../../../lib/testers-store";

export async function POST(request) {
  try {
    const { firstName, lastName, role } = await request.json();
    if (!firstName?.trim() || !lastName?.trim()) {
      return Response.json({ error: "firstName and lastName required" }, { status: 400 });
    }
    const { tester, completedScenarios } = await upsertTester({ firstName, lastName, role });
    return Response.json({ tester, completedScenarios });
  } catch (err) {
    console.error("testers/upsert error:", err);
    return Response.json({ error: "upsert failed" }, { status: 500 });
  }
}
