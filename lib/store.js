const MAX_ENTRIES = 200;
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const conversations = new Map();

function evictStale() {
  const now = Date.now();
  for (const [id, data] of conversations) {
    if (now - new Date(data.updatedAt).getTime() > TTL_MS) {
      conversations.delete(id);
    }
  }
}

export function saveConversation(id, data) {
  evictStale();
  if (conversations.size >= MAX_ENTRIES && !conversations.has(id)) {
    const oldest = conversations.keys().next().value;
    conversations.delete(oldest);
  }
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
