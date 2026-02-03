/**
 * Session memory management for PartSelect agent
 * Stores conversation state across multiple turns
 */

export const sessions = {};

/**
 * Create a new session with default state
 * @param {string} sessionId - Unique session identifier
 * @returns {Object} - New session object
 */
export function createSession(sessionId) {
  sessions[sessionId] = {
    // Conversation history
    messages: [],

    // Extracted user information
    productModel: null,    // e.g., "WDT780SAEM1"
    partNumber: null,      // e.g., "PS3406971"
    symptoms: [],          // e.g., ["Leaking", "Noisy"]

    // Current goal/intent
    goalType: "discover_needs",  // "discover_needs", "installation", "check_compatibility", "diagnose_repair"

    // Metadata
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString()
  };
  return sessions[sessionId];
}

/**
 * Get or create a session
 * @param {string} sessionId - Unique session identifier
 * @returns {Object} - Session object
 */
export function getSession(sessionId) {
  if (!sessions[sessionId]) {
    createSession(sessionId);
  }
  return sessions[sessionId];
}

/**
 * Update session metadata
 * @param {string} sessionId - Unique session identifier
 */
export function updateSessionTimestamp(sessionId) {
  if (sessions[sessionId]) {
    sessions[sessionId].lastMessageAt = new Date().toISOString();
  }
}