import { Annotation } from "@langchain/langgraph";


const replaceReducer = (current, latest) => latest !== undefined ? latest : current;

const mergeArrayReducer = (current = [], update) => {
  if (Array.isArray(update)) return update;
  return [...current, update];
};

export const AgentStateAnnotation = Annotation.Root({
 //input
  userMessage: Annotation({
    reducer: replaceReducer
  }),

  //history
  messages: Annotation({
    reducer: (current = [], update) => {
      if (Array.isArray(update)) return update;
      return [...current, update];
    }
  }),

  //memeory 
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

  // extracted info
  lastExtraction: Annotation({
    reducer: replaceReducer
  }),

  //controller
  controllerDecision: Annotation({
    reducer: replaceReducer
  }),

  nextAction: Annotation({
    reducer: replaceReducer
  }),

  //tool execution

  toolName: Annotation({
    reducer: replaceReducer
  }),

  toolInput: Annotation({
    reducer: replaceReducer
  }),

  toolResults: Annotation({
    reducer: replaceReducer
  }),

  //output
  finalResponse: Annotation({
    reducer: replaceReducer
  }),

  lastToolResult: Annotation({
    reducer: replaceReducer
  })
});
