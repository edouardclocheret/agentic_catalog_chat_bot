import { Annotation } from "@langchain/langgraph";

/**
 * State schema for the PartSelect agent
 * Defines all the information tracked across the agent's execution
 * 
 * Note: Using LangGraph 1.x API with proper reducer pattern
 */

// Helper reducer for single values - replace with latest, but keep if undefined
const replaceReducer = (current, latest) => latest !== undefined ? latest : current;

// Helper reducer for goal - preserve if not explicitly set
const goalReducer = (current, latest) => {
  if (latest !== undefined && latest !== null) return latest;
  return current; // Keep existing goal if new value is undefined/null
};

// Helper reducer for array appending
const appendReducer = (current = [], update) => {
  if (Array.isArray(update)) return update;
  return [...current, update];
};

// Helper reducer for array merge
const mergeArrayReducer = (current = [], update) => {
  if (Array.isArray(update)) return [...current, ...update];
  return [...current, update];
};

export const AgentStateAnnotation = Annotation.Root({
  // User context
  userMessage: Annotation({
    reducer: replaceReducer
  }),

  // Conversation history
  messages: Annotation({
    reducer: (current = [], update) => {
      if (Array.isArray(update)) return update;
      return [...current, update];
    }
  }),

  // Extracted information
  partNumber: Annotation({
    reducer: replaceReducer
  }),

  productModel: Annotation({
    reducer: replaceReducer
  }),

  symptoms: Annotation({
    reducer: mergeArrayReducer
  }),

  // Intent/Goal - use special reducer to preserve goal if not explicitly updated
  goalType: Annotation({
    reducer: goalReducer
  }),

  // Tool results
  toolResults: Annotation({
    reducer: appendReducer
  }),

  // Final response
  finalResponse: Annotation({
    reducer: replaceReducer
  }),

  // Track last action for debugging
  lastAction: Annotation({
    reducer: replaceReducer
  }),

  // For tool calling
  toolName: Annotation({
    reducer: replaceReducer
  }),

  toolInput: Annotation({
    reducer: replaceReducer
  })
});
