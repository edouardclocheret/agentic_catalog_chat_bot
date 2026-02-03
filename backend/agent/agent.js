import { agentGraph } from "./graph.js";

/**
 * Run the AI agent using LangGraph
 * @param {Object} state - Session state with conversation history
 * @param {string} userMessage - User's input message
 * @returns {Promise<string>} - Agent's response
 */
export async function runAgent(sessionState, userMessage) {
  try {
    // Prepare input state - include ALL fields including goalType
    const input = {
      userMessage,
      messages: sessionState.messages || [],
      partNumber: sessionState.partNumber || null,
      productModel: sessionState.productModel || null,
      symptoms: sessionState.symptoms || [],
      goalType: sessionState.goalType || null
    };

    // Invoke the agent graph
    const output = await agentGraph.invoke(input);

    // Extract the final response
    const finalResponse = output.finalResponse || "I couldn't generate a response. Please try again.";

    // Update session state with new information - including goalType
    sessionState.messages = output.messages || [];
    sessionState.partNumber = output.partNumber || sessionState.partNumber;
    sessionState.productModel = output.productModel || sessionState.productModel;
    sessionState.symptoms = output.symptoms || sessionState.symptoms;
    sessionState.goalType = output.goalType || sessionState.goalType;

    return finalResponse;
  } catch (error) {
    console.error("Agent error:", error);
    return `Sorry, I encountered an error: ${error.message}`;
  }
}
