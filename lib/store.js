// ═══════════════════════════════════════════════════════════════════════
// CONVERSATION STORE
// In-memory for demo. Swap to Vercel KV for persistence across deploys.
// ═══════════════════════════════════════════════════════════════════════

const conversations = new Map();

export function saveConversation(id, data) {
  conversations.set(id, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export function getConversation(id) {
  return conversations.get(id) || null;
}

export function getAllConversations() {
  return Array.from(conversations.values())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function generateId() {
  return `consult-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
