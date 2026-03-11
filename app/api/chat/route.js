import bphPrompt from "../../../prompts/bph";
import edPrompt from "../../../prompts/ed";
import mhPrompt from "../../../prompts/mh";
import unknownPrompt from "../../../prompts/unknown";
import { saveConversation } from "../../../lib/store";

const PROMPTS = { bph: bphPrompt, ed: edPrompt, mh: mhPrompt, unknown: unknownPrompt };

export async function POST(request) {
  try {
    const { messages, condition, conversationId, patientInfo } = await request.json();
    const systemPrompt = PROMPTS[condition] || PROMPTS.unknown;

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
        max_tokens: 1500,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    // Extract only the content — never expose full API response to client
    const content = data.content || [];

    // Save conversation state for admin
    if (conversationId) {
      saveConversation(conversationId, {
        id: conversationId,
        patientInfo,
        condition,
        messages,
        lastResponse: content,
      });
    }

    return Response.json({ content });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
