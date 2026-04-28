import { listAllTesters } from "../../../../lib/testers-store";
import { verifyAdmin, unauthorizedResponse } from "../../../../lib/auth";

export async function GET(request) {
  if (!verifyAdmin(request)) return unauthorizedResponse();
  try {
    const testers = await listAllTesters();
    return Response.json(testers);
  } catch (err) {
    console.error("admin/testers error:", err);
    return Response.json({ error: "list failed" }, { status: 500 });
  }
}
