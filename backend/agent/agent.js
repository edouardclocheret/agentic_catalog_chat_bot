import { agentGraph } from "./graph.js";

/**
 * Run the agent with the new clear graph structure
 * The graph handles:
 * 1. Extract and remember info
 * 2. Check if goal exists
 * 3. If no goal, ask what user wants
 * 4. If goal exists, check requirements
 * 5. If missing fields, ask for them
 * 6. Execute tool when ready
 * 
 * @param {Object} sessionState - Session memory
 * @param {string} userMessage - User input
 * @returns {Promise<string>} - Agent response
 */
export async function runAgent(sessionState, userMessage) {
  try {
    // Prepare input with current session state
    const input = {
      userMessage,
      messages: sessionState.messages || [],
      productModel: sessionState.productModel || null,
      partNumber: sessionState.partNumber || null,
      symptoms: sessionState.symptoms || [],
      goalType: sessionState.goalType || null
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[SESSION] Model: ${input.productModel}, Part: ${input.partNumber}, Goal: ${input.goalType}`);
    console.log(`${'='.repeat(60)}`);

    // Run the graph
    const output = await agentGraph.invoke(input);

    // Extract response
    const lastAssistantMessage = [...(output.messages || [])]
    .reverse()
    .find(m => m.role === "assistant");

    const response = lastAssistantMessage?.content 
    || output.finalResponse
    || "I'm here to help. Tell me what appliance you need help with.";

    console.log(`\n[AGENT] Full output from graph:`, JSON.stringify(output, null, 2));

    console.log(`\n[AGENT] Output from graph:`);
    console.log(`  productModel: ${output.productModel}`);
    console.log(`  partNumber: ${output.partNumber}`);
    console.log(`  goalType: ${output.goalType}`);
    console.log(`  symptoms: ${JSON.stringify(output.symptoms)}`);

    // Update session with new memory
    // CRITICAL: NEVER overwrite memory with null/undefined - always preserve!
    sessionState.messages = output.messages || sessionState.messages || [];
    sessionState.productModel = output.productModel !== undefined ? output.productModel : sessionState.productModel;
    sessionState.partNumber = output.partNumber !== undefined ? output.partNumber : sessionState.partNumber;
    sessionState.symptoms = output.symptoms !== undefined ? output.symptoms : (sessionState.symptoms || []);
    sessionState.goalType = output.goalType !== undefined ? output.goalType : sessionState.goalType;
    sessionState.lastToolResult = output.lastToolResult || null;

    console.log(`\n[AGENT] Session state after update:`);
    console.log(`  productModel: ${sessionState.productModel}`);
    console.log(`  partNumber: ${sessionState.partNumber}`);
    console.log(`  goalType: ${sessionState.goalType}`);
    console.log(`  symptoms: ${JSON.stringify(sessionState.symptoms)}`);
    console.log(`  lastToolResult:`, sessionState.lastToolResult);

    return {
      response,
      toolData: output.lastToolResult || null
    };
  } catch (error) {
    console.error(`[ERROR] Agent failed:`, error.message);
    return `Error: ${error.message}`;
  }
}
