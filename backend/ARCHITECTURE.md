# LangGraph Architecture Visualization

## Graph Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    User Input (Chat Message)                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Extract Node   │
                        │ - Store message │
                        │ - Build history │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────────────────────┐
                        │      LLM Node (GPT-4o-mini)    │
                        │ - Analyze message              │
                        │ - Decide: Use tools or not?    │
                        │ - Bind available tools         │
                        └────────┬─────────────┬──────────┘
                                 │             │
                    ┌────────────┘             └─────────────────────┐
                    │ Tools needed?                                   │ No tools
                    │                                                 │ needed
                    │ YES                                             │
                    ▼                                                 ▼
         ┌──────────────────────┐                          ┌──────────────────┐
         │   Tools Node         │                          │  End             │
         │ Execute selected tool│◄─ Tool results ────────► │ Return response  │
         └──────────┬───────────┘                          └──────────────────┘
                    │
                    │ Tool result received
                    ▼
         ┌──────────────────────────┐
         │  LLM Node (again)        │
         │ - Receive tool results   │
         │ - Generate user response │
         │ - Check if more tools    │
         └──────────┬───────────────┘
                    │
                    ├─ More tools? ───► Back to Tools Node
                    │
                    └─ Done ───────────► End (return response)
```

## State Flow

```
Session State:
{
  ┌─────────────────────────────────────────────┐
  │ messages: [                                 │
  │   {role: "user", content: "..."},          │
  │   {role: "assistant", content: "..."}      │
  │ ]                                           │
  │ userMessage: "Latest user input"           │
  │ partNumber: "PS11752778" (if found)        │
  │ productModel: "WDT780SAEM1" (if found)     │
  │ symptoms: ["ice maker not working", ...]   │
  │ toolName: null (or name of tool to run)    │
  │ toolInput: {...} (inputs for tool)         │
  │ toolResults: [{...}] (results from tools)  │
  │ finalResponse: "" (final response text)    │
  └─────────────────────────────────────────────┘
         ▲
         │ Updated by each node
         │ Persisted in server memory
}
```

## Tool Execution Flow

```
┌──────────────────┐
│ LLM selects tool │
└────────┬─────────┘
         │ toolName: "search_parts"
         │ toolInput: {query: "ice maker", model: "WDT780SAEM1"}
         ▼
┌──────────────────────────────────────────────────┐
│ Tool Executor                                    │
│ 1. Look up tool from toolMap                     │
│ 2. Validate input against Zod schema            │
│ 3. Execute tool function                        │
│ 4. Format result                                │
│ 5. Add to messages as "tool" role               │
└────────┬─────────────────────────────────────────┘
         │ result: "Found 3 matching parts: ..."
         ▼
┌──────────────────────────────────────────────────┐
│ Back to LLM with tool results                    │
│ Messages now include:                            │
│   - User message                                │
│   - Assistant message requesting tool           │
│   - Tool result                                 │
│ LLM generates next response or calls more tools │
└──────────────────────────────────────────────────┘
```

## Tool Definitions

```
Tool: search_parts
├── Schema:
│   ├── query (string): "ice maker", "PS123456", etc.
│   └── model (string): "WDT780SAEM1"
├── Returns: JSON list of matching parts
└── Used for: Finding parts by keyword/symptom

Tool: check_compatibility
├── Schema:
│   ├── partNumber (string): "PS11752778"
│   └── model (string): "WDT780SAEM1"
├── Returns: Yes/No + explanation
└── Used for: Verifying part compatibility

Tool: diagnose_repair
├── Schema:
│   ├── model (string): "WDT780SAEM1"
│   └── symptoms (array): ["ice maker not working", ...]
├── Returns: Suggested parts for repair
└── Used for: Troubleshooting

Tool: get_installation_instructions
├── Schema:
│   ├── partNumber (string): "PS11752778"
│   └── model (string): "WDT780SAEM1"
├── Returns: Installation steps
└── Used for: DIY installation help

Tool: get_part_details
├── Schema:
│   ├── partNumber (string): "PS11752778"
│   └── model (string): "WDT780SAEM1"
├── Returns: Full part information (price, warranty, etc.)
└── Used for: Detailed product info

Tool: extract_information
├── Schema:
│   └── text (string): User message
├── Returns: {partNumber, model} found in text
└── Used for: Information extraction
```

## Session Management

```
┌─────────────────────────────────────────┐
│        Server Memory                    │
│                                         │
│  sessions = {                           │
│    "uuid-1": {                          │
│      messages: [...],                   │
│      partNumber: "PS...",               │
│      productModel: "...",               │
│      symptoms: [...]                    │
│    },                                   │
│    "uuid-2": {                          │
│      messages: [...],                   │
│      ...                                │
│    }                                    │
│  }                                      │
└─────────────────────────────────────────┘
         ▲
         │ Per-session state
         │ Persists across requests
         │ Keyed by sessionId
         │ Used to maintain context
```

## Request/Response Flow

```
Frontend (React)
     │
     │ POST /api/chat
     │ {message: "...", sessionId: "uuid"}
     │
     ▼
Express Server (server.js)
     │
     ├─ Retrieve or create session
     │
     ├─ Call runAgent(sessionState, userMessage)
     │
     ▼
Agent Runner (agent.js)
     │
     ├─ Create input: {userMessage, messages, ...}
     │
     ├─ Invoke agentGraph.invoke(input)
     │
     ├─ Graph executes nodes (extract → llm → tools → llm → ...)
     │
     ├─ Tools query parts database
     │
     └─ Return finalResponse
     │
     ▼
Express Server
     │
     ├─ Update session state
     │
     ├─ JSON Response
     │ {
     │   message: "Response text",
     │   sessionId: "uuid"
     │ }
     │
     ▼
Frontend
     │
     └─ Display message in chat
```

## Multi-Tool Execution Example

```
User: "How do I fix the ice maker on my Whirlpool WDT780SAEM1?"

Step 1 - Extract Node:
  ├─ Extract model: "WDT780SAEM1"
  └─ Store in messages

Step 2 - LLM Node (First):
  ├─ See: ice maker problem + model known
  └─ Decide: Use diagnose_repair tool

Step 3 - Tools Node:
  ├─ Call diagnose_repair(model="WDT780SAEM1", symptoms=["ice maker not working"])
  ├─ Database returns: [{PS11752778: "Ice Maker Assembly", price: $189.99}]
  └─ Add result to messages

Step 4 - LLM Node (Second):
  ├─ Have part number + details
  └─ Decide: Use get_installation_instructions tool

Step 5 - Tools Node:
  ├─ Call get_installation_instructions(partNumber="PS11752778", model="WDT780SAEM1")
  ├─ Get installation steps
  └─ Add result to messages

Step 6 - LLM Node (Third):
  ├─ Have all information
  └─ Generate friendly response with:
     - Part diagnosis
     - Installation instructions
     - Price and warranty info

Response to User:
"Based on your symptoms, the Ice Maker Assembly (PS11752778) 
is likely the issue. Here's how to install it:
1. Unplug the appliance...
This part is $189.99 and has a 1-year warranty."
```

This architecture ensures:
- ✅ Intelligent tool selection by LLM
- ✅ Multi-turn conversations maintained
- ✅ Scalable to many tools
- ✅ Clear state management
- ✅ Easy debugging and extension
