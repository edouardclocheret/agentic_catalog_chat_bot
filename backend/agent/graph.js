import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentStateAnnotation } from "./state.js";
import { tools, toolMap } from "./tools.js";
import dotenv from "dotenv";

dotenv.config();

// Initialize the LLM
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.4,
  apiKey: process.env.OPENAI_API_KEY
});

// Bind tools to the LLM
const llmWithTools = llm.bindTools(tools);

/**
 * System prompt for the PartSelect agent
 */
const SYSTEM_PROMPT = `You are a helpful customer support AI agent for PartSelect, specializing in Refrigerator and Dishwasher parts.

YOUR ROLE:
Support customers with one of 4 specific goals:
1. DISCOVER_NEEDS: Understand what the user is looking for (when unclear)
2. INSTALLATION: Provide installation guides with YouTube video links
3. CHECK_COMPATIBILITY: Verify if a specific part works with a specific model
4. DIAGNOSE_REPAIR: Suggest parts that can fix reported problems

CRITICAL INSTRUCTIONS:
- You have exactly ONE goal at a time (shown in CUSTOMER CONTEXT below)
- ALWAYS focus on fulfilling that goal - never switch goals
- Do NOT ask for information you already have (see CUSTOMER CONTEXT)
- When you have enough information for your goal, USE THE APPROPRIATE TOOL immediately
- ONLY support Refrigerator and Dishwasher parts - decline politely for other appliances

GOAL-SPECIFIC BEHAVIORS:
- DISCOVER_NEEDS: Ask clarifying questions to determine which of the 4 goals applies
- INSTALLATION: Always provide YouTube link from get_installation_instructions tool
- CHECK_COMPATIBILITY: Use check_compatibility tool with model and part number
- DIAGNOSE_REPAIR: **IMMEDIATELY use diagnose_repair tool when you have model + symptoms** (symptoms are in CUSTOMER CONTEXT)

CRITICAL FOR DIAGNOSE_REPAIR:
- If CUSTOMER CONTEXT shows Symptoms and Appliance Model, CALL the diagnose_repair tool without delay
- The symptoms have been extracted and mapped to our database format
- Pass ALL symptoms listed in CUSTOMER CONTEXT to the tool

Be friendly, professional, and efficient. Use the available tools to accomplish the stated goal.`;

/**
 * Node: Process user input and extract information
 */
async function extractNode(state) {
  const userMessage = state.userMessage;

  // Add user message to history
  const messages = [...(state.messages || [])];
  messages.push({
    role: "user",
    content: userMessage
  });

  // Extract model and part numbers from the message
  const partMatch = userMessage.match(/PS\d+/i);
  // Match model numbers like WDT780SAEM1 (letters, digits, letters/digits)
  const modelMatch = userMessage.match(/[A-Z]{2,4}\d{3,}[A-Z0-9]*/i);

  const updates = { messages };

  // Update extracted information (persist across turns)
  if (partMatch) {
    updates.partNumber = partMatch[0].toUpperCase();
  }
  if (modelMatch) {
    updates.productModel = modelMatch[0].toUpperCase();
  }

  // Also preserve previously extracted info if not in current message
  if (!partMatch && state.partNumber) {
    updates.partNumber = state.partNumber;
  }
  if (!modelMatch && state.productModel) {
    updates.productModel = state.productModel;
  }

  // Extract symptoms from the message with flexible matching and mapping to exact database symptoms
  const symptomMap = {
    "Not cleaning dishes properly": ["not cleaning", "dirty dishes", "dishes aren't clean", "won't clean", "not washing"],
    "Door won't close": ["door won't close", "door stuck", "can't close door", "door doesn't close", "door stays open"],
    "Noisy": ["noisy", "loud", "noise", "sound", "making noise", "loud noise"],
    "Door latch failure": ["latch", "won't latch", "latch broken", "latch issue"],
    "Leaking": ["leak", "leaking", "water leak", "dripping", "water dripping"],
    "Will Not Start": ["won't start", "won't turn on", "not starting", "won't work", "broken", "doesn't turn on"],
    "Not draining": ["not draining", "water pooling", "draining slowly", "won't drain", "standing water", "water not draining"],
    "Not drying dishes properly": ["not drying", "dishes wet", "won't dry", "drying poorly", "dishes stay wet"]
  };
  
  const messageLower = userMessage.toLowerCase();
  const detectedSymptoms = [];
  
  // Check for exact symptom matches first
  for (const [symptom, keywords] of Object.entries(symptomMap)) {
    if (keywords.some(keyword => messageLower.includes(keyword))) {
      detectedSymptoms.push(symptom);
    }
  }

  if (detectedSymptoms.length > 0) {
    const currentSymptoms = state.symptoms || [];
    // Use Set to avoid duplicates, then convert back to array
    const allSymptoms = Array.from(new Set([...currentSymptoms, ...detectedSymptoms]));
    updates.symptoms = allSymptoms;
  } else if (state.symptoms) {
    updates.symptoms = state.symptoms;
  }

  // Detect and track user intent/goal - ONLY set if not already set
  
  // Preserve existing goal unless conversation is starting fresh or user explicitly changes it
  if (state.goalType) {
    updates.goalType = state.goalType;
  } else {
    // Only detect goal on first message (when goalType is not yet set)
    // Priority order: check_compatibility > diagnose_repair > installation > discover_needs
    
    if (messageLower.includes("compatible") || messageLower.includes("compatibility") || messageLower.includes("works with") || messageLower.includes("fit")) {
      updates.goalType = "check_compatibility";
    } else if (messageLower.includes("broken") || messageLower.includes("issue") || messageLower.includes("problem") || messageLower.includes("symptom") || messageLower.includes("fix") || messageLower.includes("repair") || messageLower.includes("not working") || messageLower.includes("leak")) {
      updates.goalType = "diagnose_repair";
    } else if (messageLower.includes("install") || messageLower.includes("instruction") || messageLower.includes("how to") || messageLower.includes("youtube")) {
      updates.goalType = "installation";
    } else {
      // Default: discover what the user wants
      updates.goalType = "discover_needs";
    }
  }

  // Always ensure we return goalType even if it was already set
  if (!updates.goalType && state.goalType) {
    updates.goalType = state.goalType;
  }

  // Always ensure symptoms are returned
  if (!updates.symptoms && state.symptoms) {
    updates.symptoms = state.symptoms;
  }

  return updates;
}

/**
 * Node: LLM decision making node
 * Decides whether to use tools or provide a direct response
 */
async function llmNode(state) {
  const messages = state.messages || [];

  // Build conversation history for LLM
  // Start with system context
  let conversationText = SYSTEM_PROMPT + "\n\n";

  // Add extracted context to system prompt
  if (state.productModel || state.partNumber || state.goalType || state.symptoms?.length > 0) {
    conversationText += "═══ CUSTOMER CONTEXT (KEEP THIS IN MIND!) ═══\n";
    if (state.goalType) {
      conversationText += `🎯 PRIMARY GOAL: ${formatGoal(state.goalType)}\n`;
      conversationText += `   → Focus on this goal. Do NOT ask for information already listed below.\n`;
    }
    if (state.productModel) {
      conversationText += `📱 Appliance Model: ${state.productModel}\n`;
    }
    if (state.partNumber) {
      conversationText += `🔧 Part Number: ${state.partNumber}\n`;
    }
    if (state.symptoms && state.symptoms.length > 0) {
      conversationText += `⚠️ Symptoms: ${state.symptoms.join(", ")}\n`;
    }
    conversationText += "═══════════════════════════════════════════\n\n";
  }

  // Add conversation history
  for (const msg of messages) {
    if (msg.role === "user") {
      conversationText += `User: ${msg.content}\n\n`;
    } else if (msg.role === "assistant") {
      conversationText += `Assistant: ${msg.content}\n\n`;
    } else if (msg.role === "tool") {
      conversationText += `Tool result: ${msg.content}\n\n`;
    }
  }

  // Call LLM with simplified message format
  const response = await llmWithTools.invoke([
    new HumanMessage({ content: conversationText })
  ]);

  // Check if tool calls are needed
  const toolCalls = response.tool_calls || [];

  // Add assistant message to history
  const updatedMessages = [
    ...messages,
    {
      role: "assistant",
      content: response.content || ""
    }
  ];

  if (toolCalls.length > 0) {
    // Return first tool call for execution
    const toolCall = toolCalls[0];
    // Add tool usage notification message
    updatedMessages.push({
      role: "assistant",
      content: `[TOOL USED: ${toolCall.name}]`
    });
    return {
      toolName: toolCall.name,
      toolInput: toolCall.args,
      messages: updatedMessages,
      productModel: state.productModel,
      partNumber: state.partNumber,
      goalType: state.goalType,
      symptoms: state.symptoms
    };
  } else {
    // No tool calls needed - return response directly
    return {
      finalResponse: response.content,
      messages: updatedMessages,
      productModel: state.productModel,
      partNumber: state.partNumber,
      goalType: state.goalType,
      symptoms: state.symptoms
    };
  }
}

/**
 * Helper function to format goal type for display
 */
function formatGoal(goalType) {
  const goalMap = {
    "discover_needs": "Understand what the user needs → Ask clarifying questions to determine their actual goal",
    "installation": "Provide installation instructions → Use get_installation_instructions tool to retrieve YouTube video links and step-by-step guides",
    "check_compatibility": "Check if a part is compatible with a model → Use check_compatibility tool when both model and part are available",
    "diagnose_repair": "Find parts to fix a problem → Use diagnose_repair tool to suggest parts that can fix the reported issue"
  };
  return goalMap[goalType] || goalType;
}

/**
 * Node: Execute tools
 */
async function toolExecutorNode(state) {
  const toolName = state.toolName;
  const toolInput = state.toolInput;

  if (!toolName || !toolMap[toolName]) {
    const errorMsg = `Unknown tool: ${toolName}`;
    const messages = [...(state.messages || [])];
    messages.push({
      role: "tool",
      content: errorMsg,
      toolName: toolName || "unknown"
    });
    return {
      messages,
      toolName: null,
      toolInput: null,
      productModel: state.productModel,
      partNumber: state.partNumber,
      goalType: state.goalType,
      symptoms: state.symptoms
    };
  }

  try {
    const tool = toolMap[toolName];
    const result = await tool.invoke(toolInput);

    // Add tool result to messages
    const messages = [...(state.messages || [])];
    messages.push({
      role: "tool",
      content: String(result),
      toolName: toolName
    });

    return {
      messages,
      toolName: null,
      toolInput: null,
      productModel: state.productModel,
      partNumber: state.partNumber,
      goalType: state.goalType,
      symptoms: state.symptoms
    };
  } catch (error) {
    const messages = [...(state.messages || [])];
    messages.push({
      role: "tool",
      content: `Error executing tool: ${error.message}`,
      toolName: toolName
    });
    return {
      messages,
      toolName: null,
      toolInput: null,
      productModel: state.productModel,
      partNumber: state.partNumber,
      goalType: state.goalType,
      symptoms: state.symptoms
    };
  }
}

/**
 * Router: Decide next step after tool execution
 */
function shouldContinueRouter(state) {
  if (state.finalResponse) {
    return "end";
  }

  if (state.toolName) {
    return "tools";
  }

  return "llm";
}

/**
 * Create and compile the agent graph
 */
export function createAgentGraph() {
  const workflow = new StateGraph(AgentStateAnnotation);

  // Add nodes
  workflow.addNode("extract", extractNode);
  workflow.addNode("llm", llmNode);
  workflow.addNode("tools", toolExecutorNode);

  // Add edges
  workflow.addEdge("extract", "llm");
  workflow.addConditionalEdges("llm", shouldContinueRouter, {
    tools: "tools",
    llm: "llm",
    end: "__end__"
  });
  workflow.addEdge("tools", "llm");

  // Set entry point
  workflow.setEntryPoint("extract");

  return workflow.compile();
}

/**
 * Create a compiled graph with memory
 */
export const agentGraph = createAgentGraph();