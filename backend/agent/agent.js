import { askLLM } from "../llm/llm.js";
import { getRepairVideo } from "../tools/videoTool.js";
import { isPartCompatible } from "../tools/compatibilityTool.js";
import { diagnoseFromSymptoms } from "../tools/diagnosisTool.js";

/**
 * Run the AI agent for a session state and user message
 */
export async function runAgent(state, userMessage, partsData) {
  state.chat.push({ role: "user", content: userMessage });

  // --- Step 1: Detect part/model from message ---
  const partMatch = userMessage.match(/PS\d+/i);
  if (partMatch) state.partNumber = partMatch[0].toUpperCase();

  const modelMatch = userMessage.match(/[A-Z]{3}\d{2,}/);
  if (modelMatch) state.productModel = modelMatch[0];

  // --- Step 2: Detect symptoms using LLM ---
  if (state.goalType === "repair") {
    if (state.symptoms.length === 0) {
      // Ask LLM to interpret the user's description and suggest symptom keywords
      const symptomPrompt = `
You are a technical assistant for dishwashers and fridges.
User described: "${userMessage}"
From this, suggest one or more likely known symptoms that match our parts database.
Respond only with a comma-separated list of symptoms.
`;
      const llmResponse = await askLLM([{ role: "user", content: symptomPrompt }]);
      const extractedSymptoms = llmResponse
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      if (extractedSymptoms.length > 0) {
        state.symptoms.push(...extractedSymptoms);
      }
    }
  }

  // --- Step 3: Determine goal type if unknown ---
  if (!state.goalType) {
    state.lastAction = "ask_goal";
    return "Hi! Are you looking for general product info, installation instructions, compatibility check, or fixing a broken part?";
  }

  // --- Step 4: Ask for missing information ---
  if (!state.productModel) {
    state.lastAction = "ask_model";
    return "Please provide the model number of your appliance.";
  }

  if (
    (state.goalType === "installation" || state.goalType === "compatibility") &&
    !state.partNumber
  ) {
    state.lastAction = "ask_part_number";
    return "Please provide the part number you're interested in.";
  }

  if (state.goalType === "repair" && state.symptoms.length === 0) {
    state.lastAction = "ask_symptom";
    return "Can you describe the problem or symptom you're experiencing?";
  }

  // --- Step 5: Handle goal-driven tools ---
  if (state.goalType === "installation") {
    return `Installation instructions for ${state.partNumber} on model ${state.productModel} are here: [TODO: insert instructions link]`;
  }

  if (state.goalType === "compatibility") {
    const ok = isPartCompatible(state.partNumber, state.productModel, partsData);
    return ok
      ? `${state.partNumber} is compatible with ${state.productModel}.`
      : `${state.partNumber} is not compatible with ${state.productModel}.`;
  }

  if (state.goalType === "repair") {
    return diagnoseFromSymptoms(state.productModel, state.symptoms, partsData);
  }

  if (state.goalType === "general_info") {
    return `Here's general information for model ${state.productModel}: [TODO: insert info]`;
  }

  // --- Step 6: Default fallback to LLM ---
  return await askLLM(state.chat);
}
