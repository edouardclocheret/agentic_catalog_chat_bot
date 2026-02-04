import { agentGraph } from "./graph.js";

/**
 * RUN AGENT
 * @param {Object} sessionState - Persisted session memory
 * @param {string} userMessage - User's current input
 * @returns {Promise<{response: string, toolData: Object}>} - Agent response and tool results
 */
export async function runAgent(sessionState, userMessage) {
  try {
    const input = {
      userMessage,
      messages: sessionState.messages || [],
      productModel: sessionState.productModel || null,
      partNumber: sessionState.partNumber || null,
      symptoms: sessionState.symptoms || [],
      goalType: sessionState.goalType || null
    };

    // Run through graph
    const output = await agentGraph.invoke(input);

    // Extract final response from messages
    const lastAssistantMessage = [...(output.messages || [])]
      .reverse()
      .find(m => m.role === "assistant");

    const response = lastAssistantMessage?.content 
      || output.finalResponse
      || "I'm here to help. Tell me what appliance you need help with.";

    // Update session state with new information
    sessionState.messages = output.messages || sessionState.messages || [];
    sessionState.productModel = output.productModel !== undefined ? output.productModel : sessionState.productModel;
    sessionState.partNumber = output.partNumber !== undefined ? output.partNumber : sessionState.partNumber;
    sessionState.symptoms = output.symptoms !== undefined ? output.symptoms : (sessionState.symptoms || []);
    sessionState.goalType = output.goalType !== undefined ? output.goalType : sessionState.goalType;
    sessionState.emailAddress = output.emailAddress !== undefined ? output.emailAddress : sessionState.emailAddress;
    sessionState.lastToolResult = output.lastToolResult || null;

    return {
      response,
      toolData: output.lastToolResult || null
    };
  } catch (error) {
    console.error("[AGENT] Error:", error.message);
    return {
      response: `Error: ${error.message}`,
      toolData: null
    };
  }
}
