import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { AgentStateAnnotation } from "./state.js";
import { tools, toolMap } from "./tools.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// LLM #1: EXTRACTOR (Low temperature: structured, controlled output)
const extractorLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.1,
  apiKey: process.env.OPENAI_API_KEY
});

// LLM #2: SPEAKER (Higher temperature: natural, conversational responses)
const speakerLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY
});

const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));

/**
 * SPEAKER PROMPT BUILDER
 * Creates context-aware prompts for the Speaker LLM based on graph state
 */
function makeSpeakerPrompt(intent, state) {
  const { goalType, productModel, partNumber, symptoms, missing } = intent;

  if (intent.type === "ask_goal") {
    return `You are a helpful PartSelect support agent. The user hasn't told you what they need yet. 
Ask them what help they need in a friendly way. Mention you can help with:
1. Installation instructions for parts
2. Checking part compatibility  
3. Diagnosing and fixing problems
4. Emailing a summary of your conversation

Be concise and friendly.`;
  }

  if (intent.type === "ask_missing") {
    let prompt = `You are a PartSelect support agent. 
Goal: ${goalType.replace(/_/g, " ")}

The user has already provided:`;

    if (productModel) prompt += `\n- Appliance model: ${productModel}`;
    if (symptoms?.length > 0) prompt += `\n- Problems: ${symptoms.join(", ")}`;
    if (partNumber) prompt += `\n- Part number: ${partNumber}`;

    prompt += `\n\nYou ONLY need to ask for these MISSING items:`;
    prompt += `\n${missing.map(m => `- ${m}`).join("\n")}`;
    
    if (goalType === "diagnose_repair") {
      prompt += `\n\nFor diagnosing issues, ONLY ask for the missing appliance model. Be brief and direct. One sentence max.`;
    } else if (goalType === "install_instruction" || goalType === "check_compatibility") {
      prompt += `\n\nFor installation or compatibility, ONLY ask for the missing model/part number. Be brief. One sentence max.`;
    } else if (goalType === "email_summary") {
      prompt += `\n\nFor emailing a summary, ONLY ask for the missing email address. Be brief. One sentence max.`;
    }

    return prompt;
  }

  if (intent.type === "tool_result") {
    return `You are a PartSelect support agent. Summarize this result for the user in a helpful way. Be concise.`;
  }

  return "";
}

/**
 * BUILD EXTRACTOR PROMPT
 * Dynamic prompt for extracting fields from user message
 */
function getExtractorPrompt() {
  const modelInstruction = `- model: appliance model (e.g., WDT780SAEM1) or null`;
  
  const partInstruction = `- part: part number (e.g., PS3406971) or null`;
  
  const goalInstruction = `- goal: detected goal from THIS message ONLY, or null

Goals (only if explicitly stated in current message):
- "diagnose_repair" if user says: fix, troubleshoot, diagnose, what's wrong, repair
- "install_instruction" if user says: install, how to install, replacement, replace
- "check_compatibility" if user says: compatible, will work, fit
- "email_summary" if user says: save, email, send, share, forward, email me
- null if user doesn't specify in this message`;

  return `Extract from user message:
${modelInstruction}
${partInstruction}
- symptoms: list of problems or []
${goalInstruction}
- email: user's email address if they provide one in THIS message, or null

Symptom mapping (match user's description to one of these exact terms):
- "Not cleaning dishes properly" if user mentions: not clean, dirty, residue, not washing
- "Door won't close" if user mentions: door stuck, door won't close, door issue, won't shut
- "Noisy" if user mentions: loud, noise, sound, squeaking, grinding, rattling
- "Door latch failure" if user mentions: latch broken, door won't latch, won't lock
- "Leaking" if user mentions: leak, drip, water, wet
- "Will Not Start" if user mentions: won't start, won't turn on, not starting
- "Not draining" if user mentions: won't drain, not draining, standing water
- "Not drying dishes properly" if user mentions: not drying, wet dishes, drying issue

Return JSON ONLY:
{
  "model": null,
  "part": null,
  "symptoms": [],
  "goal": null,
  "email": null
}`;
}

/**
 * EXTRACT NODE
 * Parses user message and updates permanent memory
 * Preserves locked fields (model, part, goal) once set
 */
async function extractNode(state) {
  const messages = [...(state.messages || [])];
  messages.push({ role: "user", content: state.userMessage });

  try {
    const dynamicPrompt = getExtractorPrompt();

    const response = await extractorLLM.invoke([
      new HumanMessage({ 
        content: dynamicPrompt + "\n\nMessage: " + state.userMessage 
      })
    ]);

    let extracted = { model: null, part: null, symptoms: [], goal: null };
    try {
      extracted = JSON.parse(response.content);
    } catch (e) {
      console.error("[EXTRACT] Failed to parse LLM response");
    }

    // Build updates - all fields can be updated
    const updates = {
      messages,
      userMessage: "",
      lastExtraction: extracted,
      productModel: extracted.model?.toUpperCase() || state.productModel || null,
      partNumber: extracted.part?.toUpperCase() || state.partNumber || null,
      goalType: extracted.goal || state.goalType || null
    };

    // Accumulate symptoms
    if (extracted.symptoms?.length > 0) {
      const allSymptoms = Array.from(new Set([...(state.symptoms || []), ...extracted.symptoms]));
      updates.symptoms = allSymptoms;
    } else {
      updates.symptoms = state.symptoms || [];
    }

    // Update email if provided
    updates.emailAddress = extracted.email || state.emailAddress || null;

    return updates;
  } catch (error) {
    console.error("[EXTRACT] Error:", error.message);
    return {
      messages,
      userMessage: "",
      productModel: state.productModel,
      partNumber: state.partNumber,
      symptoms: state.symptoms,
      goalType: state.goalType,
      emailAddress: state.emailAddress
    };
  }
}

/**
 * ROUTER: CHECK GOAL
 * Determines if user has specified what they want to do
 */
function checkGoalRouter(state) {
  const hasGoal = state.goalType && state.goalType !== "";
  return hasGoal ? "check_requirements" : "ask_goal";
}

/**
 * ASK GOAL NODE
 * Asks user what help they need
 */
async function askGoalNode(state) {
  const speakerPrompt = makeSpeakerPrompt({ type: "ask_goal" }, state);
  
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
    productModel: state.productModel,
    partNumber: state.partNumber,
    symptoms: state.symptoms,
    goalType: state.goalType,
    lastExtraction: state.lastExtraction
  };
}

/**
 * ROUTER: CHECK REQUIREMENTS
 * Validates all required fields are available for the specified goal
 */
function checkRequirementsRouter(state) {
  const goal = state.goalType;
  const hasModel = !!state.productModel;
  const hasPart = !!state.partNumber;
  const hasSymptoms = state.symptoms && state.symptoms.length > 0;
  const hasEmail = !!state.emailAddress;

  // Define what each goal requires
  const requirements = {
    install_instruction: { model: true, part: true, symptoms: false, email: false },
    check_compatibility: { model: true, part: true, symptoms: false, email: false },
    diagnose_repair: { model: true, part: false, symptoms: true, email: false },
    email_summary: { model: false, part: false, symptoms: false, email: true }
  };

  const needed = requirements[goal] || {};
  const missing = [];

  if (needed.model && !hasModel) missing.push("appliance model");
  if (needed.part && !hasPart) missing.push("part number");
  if (needed.symptoms && !hasSymptoms) missing.push("symptoms");
  if (needed.email && !hasEmail) missing.push("email address");

  if (missing.length > 0) {
    state.missingInfo = missing;
    return "ask_info";
  }

  return "execute_tool";
}

/**
 * ASK INFO NODE
 * Requests missing information from user
 */
async function askInfoNode(state) {
  const missing = state.missingInfo || [];

  const speakerPrompt = makeSpeakerPrompt({ 
    type: "ask_missing",
    goalType: state.goalType,
    productModel: state.productModel,
    partNumber: state.partNumber,
    symptoms: state.symptoms,
    missing: missing
  }, state);
  
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
    productModel: state.productModel,
    partNumber: state.partNumber,
    symptoms: state.symptoms,
    goalType: state.goalType,
    lastExtraction: state.lastExtraction
  };
}

/**
 * EXECUTE TOOL NODE
 * Calls the appropriate tool based on goal and renders result
 */
async function executeToolNode(state) {
  const { goalType, productModel, partNumber, symptoms, emailAddress, messages } = state;

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
  } else if (goalType === "email_summary") {
    toolName = "email_summary";
    const conversationSummary = messages
      .map(m => `${m.role === "user" ? "You" : "Agent"}: ${m.content}`)
      .join("\n\n");
    toolInput = { email: emailAddress, conversationSummary };
  }

  if (!toolName || !toolMap[toolName]) {
    return {
      ...state,
      userMessage: "",
      finalResponse: "I couldn't determine the right tool for your request."
    };
  }

  try {
    const tool = toolMap[toolName];
    const result = await tool.invoke(toolInput);

    let parsedResult = result;
    if (typeof result === "string") {
      try {
        parsedResult = JSON.parse(result);
      } catch {
        parsedResult = result;
      }
    }

    // Render tool result through Speaker LLM
    const speakerPrompt = makeSpeakerPrompt({ type: "tool_result" }, state);
    
    let speakerInput = String(result);
    if (toolName === "diagnose_repair" && typeof parsedResult === "object" && parsedResult.suggestedParts) {
      const partsText = parsedResult.suggestedParts
        .map(p => `- ${p.name} (Part #${p.partNumber}) - $${p.price}`)
        .join("\n");
      speakerInput = `Found ${parsedResult.suggestedParts.length} parts that might fix: ${parsedResult.symptoms?.join(", ")}\n\n${partsText}`;
    }
    
    const speakerResponse = await speakerLLM.invoke([
      new HumanMessage({ 
        content: speakerPrompt + "\n\n[Tool Result]\n" + speakerInput
      })
    ]);

    const updatedMessages = [...(state.messages || [])];
    updatedMessages.push({ role: "tool", content: String(result) });
    updatedMessages.push({ role: "assistant", content: speakerResponse.content });

    return {
      messages: updatedMessages,
      userMessage: "",
      finalResponse: speakerResponse.content,
      lastToolResult: {
        toolName,
        data: parsedResult
      },
      productModel: state.productModel,
      partNumber: state.partNumber,
      symptoms: state.symptoms,
      emailAddress: state.emailAddress,
      goalType: null,  // Clear goal after tool execution
      lastExtraction: state.lastExtraction
    };
  } catch (error) {
    console.error("[EXECUTE] Tool error:", error.message);
    return {
      userMessage: "",
      finalResponse: `Error: ${error.message}`,
      messages: state.messages,
      productModel: state.productModel,
      partNumber: state.partNumber,
      symptoms: state.symptoms,
      emailAddress: state.emailAddress,
      goalType: null,  // Clear goal even on error
      lastExtraction: state.lastExtraction
    };
  }
}

/**
 * CREATE AND COMPILE AGENT GRAPH
 */
function createAgentGraph() {
  const workflow = new StateGraph(AgentStateAnnotation);

  workflow.addNode("extract", extractNode);
  workflow.addNode("ask_goal", askGoalNode);
  workflow.addNode("ask_info", askInfoNode);
  workflow.addNode("execute_tool", executeToolNode);

  workflow.setEntryPoint("extract");
  
  workflow.addConditionalEdges("extract", checkGoalRouter, {
    ask_goal: "ask_goal",
    check_requirements: "check_requirements"
  });

  workflow.addEdge("ask_goal", "__end__");

  workflow.addNode("check_requirements", (state) => {
    return { ...state, missingInfo: null };
  });
  
  workflow.addConditionalEdges("check_requirements", checkRequirementsRouter, {
    ask_info: "ask_info",
    execute_tool: "execute_tool"
  });

  workflow.addEdge("ask_info", "__end__");
  workflow.addEdge("execute_tool", "__end__");

  return workflow.compile();
}

export const agentGraph = createAgentGraph();
