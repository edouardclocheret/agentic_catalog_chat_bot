# LangGraph Agent Setup Guide

## Overview

Your PartSelect chat agent is now built with **LangGraph**, a framework for building stateful, multi-actor applications with language models. This provides a more robust, scalable, and maintainable architecture compared to the previous implementation.

## Architecture

### Key Components

#### 1. **State Management** (`agent/state.js`)
Defines the conversation state using LangGraph's `Annotation` system:
- `userMessage` - Current user input
- `messages` - Full conversation history
- `partNumber` - Extracted part number (e.g., PS11752778)
- `productModel` - Extracted appliance model (e.g., WDT780SAEM1)
- `symptoms` - List of detected problems/symptoms
- `goalType` - Type of user's request
- `toolResults` - Results from executed tools
- `finalResponse` - Agent's response to user

#### 2. **Tools** (`agent/tools.js`)
Implements 6 specialized tools using LangChain's tool system:

- **search_parts** - Search for parts by keyword, symptom, or part number
- **check_compatibility** - Verify if a part works with a model
- **diagnose_repair** - Suggest parts based on symptoms
- **get_installation_instructions** - Retrieve installation steps
- **get_part_details** - Get full part information
- **extract_information** - Extract part/model numbers from text

Each tool has:
- Clear description for the LLM to understand its purpose
- Zod schema defining input parameters
- Implementation logic that queries your parts database

#### 3. **Workflow Graph** (`agent/graph.js`)
The LangGraph workflow with:

```
extract → llm → [decision] → tools → llm → [final response]
                      ↓
                    end
```

**Nodes:**
- `extract` - Process user input
- `llm` - LLM decision making with tool binding
- `tools` - Execute selected tools
- `__end__` - End of conversation

**Flow:**
1. Extract user message and add to history
2. Call LLM with tools available
3. If LLM selects a tool, execute it
4. Return tool results to LLM for final response
5. If no tools needed, return response directly

#### 4. **Agent Runner** (`agent/agent.js`)
Simple interface to run the graph:
- Takes session state and user message
- Invokes the compiled graph
- Updates session with new information
- Returns final response

#### 5. **Server** (`server.js`)
Express API with LangGraph integration:
- `POST /api/chat` - Main chat endpoint
- `GET /health` - Health check
- `GET /api/sessions/:id` - Session debugging

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

New packages added:
- `@langchain/core` - Core LangChain types and interfaces
- `@langchain/langgraph` - Graph execution engine
- `@langchain/openai` - OpenAI integration
- `dotenv` - Environment variable management

### 2. Configure Environment

Create `.env` file in `backend/`:

```env
OPENAI_API_KEY=sk-... # Your OpenAI API key
PORT=3001
```

### 3. Run the Server

```bash
npm start
```

Expected output:
```
🧠 PartSelect Chat Agent running on http://localhost:3001
📝 Health check: http://localhost:3001/health
```

### 4. Test the Agent

#### Via curl:
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How can I fix the ice maker on my WDT780SAEM1?"}'
```

#### Via frontend:
The frontend automatically connects to `http://localhost:3001` (configurable via `REACT_APP_API_URL` env var)

## How It Works

### Example Flow: Troubleshooting

**User:** "The ice maker on my WDT780SAEM1 is not working"

1. **Extract Node**: Stores message in history, extracts model "WDT780SAEM1"
2. **LLM Node**: 
   - Sends message to GPT-4o-mini with available tools
   - LLM decides to call `diagnose_repair` tool
3. **Tools Node**:
   - Executes `diagnose_repair` with model="WDT780SAEM1" and symptoms=["ice maker not working"]
   - Gets matching parts from database
4. **LLM Node** (again):
   - Receives tool results
   - Generates user-friendly response with part recommendations
5. **Response**: User gets helpful diagnosis with part numbers and options

## Key Features

### ✅ Tool-Use Architecture
- LLM intelligently decides when to use tools
- Supports multi-turn tool usage
- Tools have clear schemas for reliable execution

### ✅ State Persistence
- Conversation history maintained across turns
- Extracted information (part numbers, models) persisted
- Session management per user

### ✅ Scalability
- Graph-based design supports complex workflows
- Easy to add new nodes or tools
- Memory-efficient state management

### ✅ Error Handling
- Try-catch wrapper around agent execution
- Graceful error messages to user
- Session persistence even on errors

## Extending the Agent

### Adding a New Tool

1. Define the tool in `agent/tools.js`:

```javascript
export const myNewTool = tool(
  async ({ input1, input2 }) => {
    // Implementation
    return "Result";
  },
  {
    name: "my_new_tool",
    description: "What this tool does",
    schema: z.object({
      input1: z.string().describe("First input"),
      input2: z.string().describe("Second input")
    })
  }
);
```

2. Add to `tools` array and `toolMap`:

```javascript
export const tools = [..., myNewTool];
export const toolMap = { ..., my_new_tool: myNewTool };
```

3. The tool is automatically available to the LLM!

### Adding a New Node

1. Define a node function in `agent/graph.js`:

```javascript
async function myNode(state) {
  // Process state
  return { /* updated state */ };
}
```

2. Add to graph:

```javascript
workflow.addNode("my_node", myNode);
workflow.addEdge("previous_node", "my_node");
```

### Modifying the System Prompt

Edit `SYSTEM_PROMPT` in `agent/graph.js` to change agent behavior.

## Debugging

### View Session State
```bash
curl http://localhost:3001/api/sessions/{sessionId}
```

### Check Logs
The server logs:
- Tool executions
- Graph flow decisions
- Errors with stack traces

### LangGraph Studio (Optional)
For visual debugging, use [LangGraph Studio](https://studio.langchain.com):
1. Export compiled graph
2. Upload to studio
3. Trace execution visually

## Production Considerations

### Performance
- Consider caching parts database
- Implement rate limiting on `/api/chat`
- Monitor token usage (OpenAI costs)

### Reliability
- Add request validation middleware
- Implement timeout for LLM calls
- Add retry logic for failed tools

### Security
- Validate all user inputs
- Rate limit per session
- Add authentication if needed
- Sanitize responses before sending to frontend

## Troubleshooting

### "Module not found" errors
```bash
npm install @langchain/core @langchain/langgraph @langchain/openai
```

### "OPENAI_API_KEY not found"
- Ensure `.env` file exists in `backend/` directory
- Key should start with `sk-`
- Restart server after adding/changing key

### Slow responses
- LLM calls typically take 1-3 seconds
- Tool execution depends on database queries
- Network latency to OpenAI API

### Tool not being called
- Check tool schema in `agent/tools.js`
- Verify tool description is clear
- Check LLM temperature (0.4 is good for deterministic behavior)

## Files Summary

```
backend/
├── agent/
│   ├── state.js       # State schema definition
│   ├── tools.js       # Tool definitions
│   ├── graph.js       # LangGraph workflow
│   ├── agent.js       # Agent runner
│   └── memory.js      # (Optional) for advanced memory)
├── tools/             # Legacy tools (now wrapped in LangGraph)
├── llm/               # Legacy LLM helpers
├── data/              # Parts database
├── server.js          # Express server
├── package.json       # Updated with LangGraph deps
├── .env               # Configuration
└── README.md          # This file
```

## Next Steps

1. **Test thoroughly** - Try various user inputs
2. **Optimize prompts** - Tweak `SYSTEM_PROMPT` for better responses
3. **Add more tools** - Consider adding:
   - Video tutorials tool
   - Pricing/inventory tool
   - Order history tool
4. **Monitor performance** - Track response times and costs
5. **Collect feedback** - Improve based on user interactions

## Resources

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LangChain Tools](https://js.langchain.com/docs/modules/tools/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Zod Schema Library](https://zod.dev/)
