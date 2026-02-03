export const sessions = {};

// Default state for a new session
export function createSession(sessionId) {
  sessions[sessionId] = {
    chat: [],
    goalType: null,      // "general_info", "installation", "compatibility", "repair"
    productModel: null,
    partNumber: null,
    symptoms: [],
    lastAction: null
  };
  return sessions[sessionId];
}

export function getSession(sessionId) {
  if (!sessions[sessionId]) createSession(sessionId);
  return sessions[sessionId];
}