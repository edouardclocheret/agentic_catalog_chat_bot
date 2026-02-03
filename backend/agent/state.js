import { Annotation } from "@langchain/langgraph";

/**
 * State schema for the 3-role PartSelect agent
 * 
 * Architecture:
 * - Extractor: Fills in lastExtraction, updates model/part/symptoms/goalType
 * - Controller: Uses context to decide nextAction, can set toolName/toolInput
 * - Tool: Uses toolName/toolInput, fills in toolResults
 * - Answer: Uses toolResults to fill finalResponse
 */

const replaceReducer = (current, latest) => latest !== undefined ? latest : current;

const mergeArrayReducer = (current = [], update) => {
  if (Array.isArray(update)) return update;
  return [...current, update];
};

export const AgentStateAnnotation = Annotation.Root({
  // ═══════════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════════
  userMessage: Annotation({
    reducer: replaceReducer
  }),

  // ═══════════════════════════════════════════════════════════
  // CONVERSATION HISTORY
  // ═══════════════════════════════════════════════════════════
  messages: Annotation({
    reducer: (current = [], update) => {
      if (Array.isArray(update)) return update;
      return [...current, update];
    }
  }),

  // ═══════════════════════════════════════════════════════════
  // MEMORY - Extracted Information
  // ═══════════════════════════════════════════════════════════
  productModel: Annotation({
    reducer: replaceReducer
  }),

  partNumber: Annotation({
    reducer: replaceReducer
  }),

  symptoms: Annotation({
    reducer: mergeArrayReducer
  }),

  goalType: Annotation({
    reducer: replaceReducer
  }),

  emailAddress: Annotation({
    reducer: replaceReducer
  }),

  // ═══════════════════════════════════════════════════════════
  // EXTRACTION RESULTS - What the Extractor found
  // ═══════════════════════════════════════════════════════════
  lastExtraction: Annotation({
    reducer: replaceReducer
  }),

  // ═══════════════════════════════════════════════════════════
  // CONTROLLER STATE - Decision making
  // ═══════════════════════════════════════════════════════════
  controllerDecision: Annotation({
    reducer: replaceReducer
  }),

  nextAction: Annotation({
    reducer: replaceReducer
  }),

  // ═══════════════════════════════════════════════════════════
  // TOOL EXECUTION
  // ═══════════════════════════════════════════════════════════
  toolName: Annotation({
    reducer: replaceReducer
  }),

  toolInput: Annotation({
    reducer: replaceReducer
  }),

  toolResults: Annotation({
    reducer: replaceReducer
  }),

  // ═══════════════════════════════════════════════════════════
  // FINAL OUTPUT
  // ═══════════════════════════════════════════════════════════
  finalResponse: Annotation({
    reducer: replaceReducer
  }),

  lastToolResult: Annotation({
    reducer: replaceReducer
  })
});
