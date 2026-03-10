import { getAllConversations, getConversation } from "../../../../lib/store";
import { verifyAdmin, unauthorizedResponse } from "../../../../lib/auth";

export async function GET(request) {
  if (!verifyAdmin(request)) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const conversation = getConversation(id);
    if (!conversation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(conversation);
  }

  const conversations = getAllConversations();
  return Response.json(conversations);
}
