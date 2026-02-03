import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { AgentStateAnnotation } from "./state.js";
import { tools, toolMap } from "./tools.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// LLM #1: EXTRACTOR (Silent, structured, controlled)
const extractorLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.1,
  apiKey: process.env.OPENAI_API_KEY
});

// LLM #2: SPEAKER (Talks to user, follows graph decisions)
const speakerLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY
});

const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));

/**
 * SPEAKER PROMPT BUILDER
 * Takes graph decisions and creates a prompt for the Speaker LLM
 */
function makeSpeakerPrompt(intent, state) {
  const { goalType, productModel, partNumber, symptoms, missing } = intent;

  if (intent.type === "ask_goal") {
    return `You are a helpful PartSelect support agent. The user hasn't told you what they need yet. 
Ask them what help they need in a friendly way. Mention you can help with:
1. Installation instructions for parts
2. Checking part compatibility  
3. Diagnosing and fixing problems

Be concise and friendly.`;
  }

  if (intent.type === "ask_missing") {
    let prompt = `You are a PartSelect support agent. 
Goal: ${goalType.replace(/_/g, " ")}

The user has already provided some info:`;

    if (productModel) prompt += `\n- Appliance model: ${productModel}`;
    if (partNumber) prompt += `\n- Part number: ${partNumber}`;
    if (symptoms?.length > 0) prompt += `\n- Problems: ${symptoms.join(", ")}`;

    prompt += `\n\nYou ONLY need to ask for the MISSING items:\n${missing.map(m => `- ${m}`).join("\n")}

Ask for ONLY these items. Be specific with examples. Be concise.`;

    return prompt;
  }

  if (intent.type === "tool_result") {
    return `You are a PartSelect support agent. Summarize this result for the user in a helpful way. Be concise.`;
  }

  return "";
}

/**
 * Utility: Log memory and last extraction side-by-side
 */
function logMemoryState(state, label = "") {
  console.log(`\n[${label}] MEMORY & EXTRACTION STATE:`);
  console.log(`  📦 MEMORY:`);
  console.log(`     Model: ${state.productModel || "null"}`);
  console.log(`     Part: ${state.partNumber || "null"}`);
  console.log(`     Goal: ${state.goalType || "null"}`);
  console.log(`     Symptoms: ${state.symptoms?.length > 0 ? state.symptoms.join(", ") : "[]"}`);
  
  if (state.lastExtraction) {
    console.log(`  🔍 LAST EXTRACTION:`);
    console.log(`     Model: ${state.lastExtraction.model || "null"}`);
    console.log(`     Part: ${state.lastExtraction.part || "null"}`);
    console.log(`     Goal: ${state.lastExtraction.goal || "null"}`);
    console.log(`     Symptoms: ${state.lastExtraction.symptoms?.length > 0 ? state.lastExtraction.symptoms.join(", ") : "[]"}`);
  }
}

/**
 * ROLE 1: EXTRACT - Parse user message and add to permanent memory
 * 
 * IMPORTANT: Once model, part number, or goal are set in memory, they are LOCKED
 * and will NOT be re-extracted. Only symptoms continue to accumulate.
 */
function getExtractorPrompt(productModel, partNumber, goalType) {
  // Only lock fields that actually exist
  const modelInstruction = productModel
    ? `- model: ALWAYS return null (already known: ${productModel})`
    : `- model: appliance model (e.g., WDT780SAEM1) or null`;
  
  const partInstruction = partNumber
    ? `- part: ALWAYS return null (already known: ${partNumber})`
    : `- part: part number (e.g., PS3406971) or null`;
  
  const goalInstruction = goalType
    ? `- goal: ALWAYS return null (already locked as ${goalType})`
    : `- goal: detected goal from THIS message ONLY, or null (do NOT use memory goal)

Goals (only if explicitly stated in current message):
- "diagnose_repair" if user says: fix, troubleshoot, diagnose, what's wrong, repair
- "install_instruction" if user says: install, how to install, replacement, replace
- "check_compatibility" if user says: compatible, will work, fit
- null if user doesn't specify in this message`;

  return `Extract from user message:
${modelInstruction}
${partInstruction}
- symptoms: list of problems or []
${goalInstruction}

Symptom mapping:
- leak/drip/water → "leaking"
- loud/noise/sound → "noisy"
- won't start/not start/won't turn on → "won't start"
- not clean/dirty/residue → "not cleaning"
- stuck/won't close/won't open → "door issue"
- won't drain/drain → "not draining"

Return JSON ONLY:
{
  "model": null,
  "part": null,
  "symptoms": [],
  "goal": null
}`;
}

async function extractNode(state) {
  console.log(`\n[EXTRACT] Parsing message...`);
  logMemoryState(state, "EXTRACT START");
  
  const messages = [...(state.messages || [])];
  messages.push({ role: "user", content: state.userMessage });

  try {
    // Build dynamic prompt based on what's already in memory
    // Only lock fields that actually exist
    const dynamicPrompt = getExtractorPrompt(
      state.productModel,
      state.partNumber,
      state.goalType
    );

    const response = await extractorLLM.invoke([
      new HumanMessage({ 
        content: dynamicPrompt + "\n\nMessage: " + state.userMessage 
      })
    ]);

    let extracted = { model: null, part: null, symptoms: [], goal: null };
    try {
      extracted = JSON.parse(response.content);
    } catch (e) {
      console.error(`  Parse error:`, response.content);
    }

    console.log(`\n  📝 LLM extracted:`, JSON.stringify(extracted, null, 2));

    // IMPORTANT: Memory update strategy
    // 1. Always preserve ALL existing memory as base
    // 2. Only UPDATE memory if LLM extracted a NON-NULL value
    // 3. If LLM returned null, keep the previous value unchanged
    
    const updates = {
      messages,
      userMessage: "",
      lastExtraction: extracted,
      // ALWAYS carry forward existing memory as base
      productModel: state.productModel || null,
      partNumber: state.partNumber || null,
      symptoms: state.symptoms || [],
      goalType: state.goalType || null
    };

    // Model - Update ONLY if LLM extracted a non-null value, otherwise preserve
    if (extracted.model !== null && extracted.model !== undefined) {
      updates.productModel = extracted.model.toUpperCase();
      console.log(`  ✓ Model updated → memory: ${extracted.model}`);
    } else {
      // Always preserve existing model (never set to null)
      updates.productModel = state.productModel || null;
      if (state.productModel) {
        console.log(`  🔒 Model preserved: ${state.productModel}`);
      }
    }

    // Part number - Update ONLY if LLM extracted a non-null value, otherwise preserve
    if (extracted.part !== null && extracted.part !== undefined) {
      updates.partNumber = extracted.part.toUpperCase();
      console.log(`  ✓ Part updated → memory: ${extracted.part}`);
    } else {
      // Always preserve existing part (never set to null)
      updates.partNumber = state.partNumber || null;
      if (state.partNumber) {
        console.log(`  🔒 Part preserved: ${state.partNumber}`);
      }
    }

    // Symptoms - Accumulate new symptoms, preserve existing
    if (extracted.symptoms?.length > 0) {
      const allSymptoms = Array.from(new Set([...(state.symptoms || []), ...extracted.symptoms]));
      updates.symptoms = allSymptoms;
      console.log(`  ✓ Symptoms accumulated → memory: ${allSymptoms.join(", ")}`);
    } else {
      // Always preserve existing symptoms (never clear)
      updates.symptoms = state.symptoms || [];
      if (state.symptoms?.length > 0) {
        console.log(`  🔒 Symptoms preserved: ${state.symptoms.join(", ")}`);
      }
    }

    // Goal - Update ONLY if LLM extracted a non-null value, otherwise preserve
    if (extracted.goal !== null && extracted.goal !== undefined) {
      updates.goalType = extracted.goal;
      console.log(`  ✓ Goal updated → memory: ${extracted.goal}`);
    } else {
      // Always preserve existing goal (never set to null)
      updates.goalType = state.goalType || null;
      if (state.goalType) {
        console.log(`  🔒 Goal preserved: ${state.goalType}`);
      }
    }

    // Log final state after extraction processing
    console.log(`\n  ✅ EXTRACT node complete - Updated memory:`);
    console.log(`     Model: ${updates.productModel || "null"}`);
    console.log(`     Part: ${updates.partNumber || "null"}`);
    console.log(`     Goal: ${updates.goalType || "null"}`);
    console.log(`     Symptoms: ${updates.symptoms?.length > 0 ? updates.symptoms.join(", ") : "[]"}`);

    return updates;
  } catch (error) {
    console.error(`  [ERROR] Extraction failed:`, error.message);
    return {
      messages,
      userMessage: "",
      productModel: state.productModel,
      partNumber: state.partNumber,
      symptoms: state.symptoms,
      goalType: state.goalType
    };
  }
}

/**
 * CHECK GOAL - Decide what to ask for next
 */
function checkGoalRouter(state) {
  // Step 1: Is there a goal in memory?
  if (!state.goalType) {
    console.log(`[ROUTER] No goal in memory → ASK_GOAL`);
    return "ask_goal";
  }

  console.log(`[ROUTER] Goal in memory: ${state.goalType} → CHECK_REQUIREMENTS`);
  return "check_requirements";
}

/**
 * ASK GOAL NODE - Ask user what they want to do
 */
async function askGoalNode(state) {
  console.log(`\n[ASK_GOAL] No goal detected, asking user...`);

  // Build speaker prompt
  const speakerPrompt = makeSpeakerPrompt({ type: "ask_goal" }, state);
  
  // Let Speaker LLM decide what to say
  const speakerResponse = await speakerLLM.invoke([
    new HumanMessage({ content: speakerPrompt })
  ]);

  const messages = [
    ...(state.messages || []),
    {
      role: "assistant",
      content: speakerResponse.content
    }
  ];

  return {
    messages,
    userMessage: "",
    // Always explicitly return all state fields
    productModel: state.productModel,
    partNumber: state.partNumber,
    symptoms: state.symptoms,
    goalType: state.goalType,
    lastExtraction: state.lastExtraction
  };
}

/**
 * CHECK REQUIREMENTS - Does goal have all needed info?
 * IMPORTANT: Checks MEMORY state, not last extraction
 */
function checkRequirementsRouter(state) {
  logMemoryState(state, "CHECK REQUIREMENTS");
  
  const goal = state.goalType;
  // Check MEMORY, not lastExtraction
  const hasModel = !!state.productModel;
  const hasPart = !!state.partNumber;
  const hasSymptoms = state.symptoms && state.symptoms.length > 0;

  console.log(`[CHECK] Checking MEMORY for goal: ${goal}`);
  console.log(`[CHECK]   Model in memory: ${state.productModel || "none"} (required: true)`);
  console.log(`[CHECK]   Part in memory: ${state.partNumber || "none"} (required: true)`);
  console.log(`[CHECK]   Symptoms in memory: ${state.symptoms?.join(", ") || "none"}`);

  // Define what each goal needs
  const requirements = {
    install_instruction: { model: true, part: true, symptoms: false },
    check_compatibility: { model: true, part: true, symptoms: false },
    diagnose_repair: { model: true, part: false, symptoms: true }
  };

  const needed = requirements[goal] || {};
  const missing = [];

  if (needed.model && !hasModel) missing.push("appliance model");
  if (needed.part && !hasPart) missing.push("part number");
  if (needed.symptoms && !hasSymptoms) missing.push("symptoms");

  if (missing.length > 0) {
    console.log(`[CHECK] Missing in memory: ${missing.join(", ")} → ASK_INFO`);
    state.missingInfo = missing;
    return "ask_info";
  }

  console.log(`[CHECK] ✓ All requirements found in memory → EXECUTE_TOOL`);
  return "execute_tool";
}

/**
 * ASK INFO NODE - Ask for missing information
 */
async function askInfoNode(state) {
  const missing = state.missingInfo || [];
  console.log(`\n[ASK_INFO] Missing: ${missing.join(", ")}`);

  // Build speaker prompt with structured intent
  const speakerPrompt = makeSpeakerPrompt({ 
    type: "ask_missing",
    goalType: state.goalType,
    productModel: state.productModel,
    partNumber: state.partNumber,
    symptoms: state.symptoms,
    missing: missing
  }, state);
  
  // Let Speaker LLM decide what to say
  const speakerResponse = await speakerLLM.invoke([
    new HumanMessage({ content: speakerPrompt })
  ]);

  const messages = [
    ...(state.messages || []),
    {
      role: "assistant",
      content: speakerResponse.content
    }
  ];

  return {
    messages,
    userMessage: "",
    missingInfo: null,
    // Always explicitly return all state fields
    productModel: state.productModel,
    partNumber: state.partNumber,
    symptoms: state.symptoms,
    goalType: state.goalType,
    lastExtraction: state.lastExtraction
  };
}

/**
 * EXECUTE TOOL NODE
 */
async function executeToolNode(state) {
  logMemoryState(state, "EXECUTE TOOL");
  
  const { goalType, productModel, partNumber, symptoms } = state;

  console.log(`\n[EXECUTE] Calling tool for goal: ${goalType}`);
  console.log(`  Model: ${productModel}, Part: ${partNumber}, Symptoms: ${symptoms?.join(", ")}`);

  let toolName, toolInput;

  if (goalType === "diagnose_repair") {
    toolName = "diagnose_repair";
    toolInput = { model: productModel, symptoms };
  } else if (goalType === "install_instruction") {
    toolName = "get_installation_instructions";
    toolInput = { partNumber, model: productModel };
  } else if (goalType === "check_compatibility") {
    toolName = "check_compatibility";
    toolInput = { partNumber, model: productModel };
  }

  if (!toolName || !toolMap[toolName]) {
    console.error(`  [ERROR] Unknown tool for goal: ${goalType}`);
    return {
      ...state,
      userMessage: "",
      finalResponse: "I couldn't determine the right tool for your request."
    };
  }

  try {
    console.log(`  Calling tool: ${toolName}`);
    const tool = toolMap[toolName];
    const result = await tool.invoke(toolInput);
    console.log(`  ✓ Tool executed`);

    // Let Speaker LLM render the tool result
    const speakerPrompt = makeSpeakerPrompt({ type: "tool_result" }, state);
    const speakerResponse = await speakerLLM.invoke([
      new HumanMessage({ 
        content: speakerPrompt + "\n\n[Tool Result]\n" + String(result)
      })
    ]);

    const messages = [...(state.messages || [])];
    messages.push({ role: "tool", content: String(result) });
    messages.push({ role: "assistant", content: speakerResponse.content });

    return {
      messages,
      userMessage: "",
      finalResponse: speakerResponse.content,
      // Always explicitly return all state fields
      productModel: state.productModel,
      partNumber: state.partNumber,
      symptoms: state.symptoms,
      goalType: state.goalType,
      lastExtraction: state.lastExtraction
    };
  } catch (error) {
    console.error(`  [ERROR] Tool execution failed:`, error.message);
    return {
      userMessage: "",
      finalResponse: `Error: ${error.message}`,
      // Always explicitly return all state fields
      messages: state.messages,
      productModel: state.productModel,
      partNumber: state.partNumber,
      symptoms: state.symptoms,
      goalType: state.goalType,
      lastExtraction: state.lastExtraction
    };
  }
}

/**
 * BUILD THE GRAPH
 */
export function createAgentGraph() {
  const workflow = new StateGraph(AgentStateAnnotation);

  // Add all nodes
  workflow.addNode("extract", extractNode);
  workflow.addNode("ask_goal", askGoalNode);
  workflow.addNode("ask_info", askInfoNode);
  workflow.addNode("execute_tool", executeToolNode);

  // Define the flow:
  // 1. Always start with extract (parse message, update memory)
  workflow.setEntryPoint("extract");
  
  // 2. After extract, check if goal exists
  workflow.addConditionalEdges("extract", checkGoalRouter, {
    ask_goal: "ask_goal",
    check_requirements: "check_requirements"
  });

  // 3. If no goal, ask for it, then loop back to extract
  workflow.addEdge("ask_goal", "__end__");

  // 4. After goal is known, add a "virtual" node that routes based on requirements
  // We need to add a special node for the router
  workflow.addNode("check_requirements", (state) => {
    // Clear missingInfo when entering this node so it doesn't persist
    return { ...state, missingInfo: null };
  });
  workflow.addConditionalEdges("check_requirements", checkRequirementsRouter, {
    ask_info: "ask_info",
    execute_tool: "execute_tool"
  });

  // 5. If info is missing, ask for it, then loop back to extract
  workflow.addEdge("ask_info", "__end__");

  // 6. If all requirements met, execute tool and end
  workflow.addEdge("execute_tool", "__end__");

  console.log(`[LANGGRAPH] Graph structure initialized`);
  return workflow.compile();
}

export const agentGraph = createAgentGraph();
