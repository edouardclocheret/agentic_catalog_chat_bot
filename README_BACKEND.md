# PartSelect Assistant - Backend Architecture

## Overview

The backend is a **LangGraph-based agentic system** that combines two specialized LLMs to provide intelligent appliance support:
- **Extractor LLM** (GPT-4o-mini, temp 0.1): Silent, structured information extraction
- **Speaker LLM** (GPT-4o-mini, temp 0.7): Natural, conversational user responses

## Project Structure

```
backend/
├── server.js              # Express server, session management, API endpoints
├── config.js              # Configuration (ports, settings)
├── package.json           # Dependencies
├── .env                   # Environment variables (email credentials)
├── data/
│   └── parts.json         # Parts database with symptoms and compatibility
└── agent/
    ├── graph.js           # LangGraph state machine (586 lines)
    ├── agent.js           # Agent orchestration
    ├── state.js           # State schema definition
    ├── tools.js           # Tool implementations (4 tools)
    └── memory.js          # Persistent memory storage
```

## Core Components

### 1. Express Server (`server.js`)

**Port:** 3001

**API Endpoints:**

- **POST `/api/chat`**
  - Request: `{ message: string, sessionId?: string }`
  - Response: `{ message: string, sessionId: string, toolData?: Object }`
  - Creates new session or reuses existing one
  - Persists state across multiple turns

- **GET `/health`**
  - Health check endpoint
  - Response: `{ status: "ok", timestamp: ISO8601 }`

- **GET `/api/sessions/:id`**
  - Debug endpoint to inspect session state
  - Returns full memory for a session

**Session Management:**
```javascript
{
  messages: [],              // Full conversation history
  productModel: null,        // Locked once set (e.g., "WDT780SAEM1")
  partNumber: null,          // Locked once set (e.g., "PS3406971")
  symptoms: [],              // Accumulates over conversation
  goalType: null,            // Current user intent (diagnose, install, etc.)
  emailAddress: null,        // User email for sending summaries
  lastToolResult: null       // Latest tool output for frontend rendering
}
```

### 2. LangGraph State Machine (`graph.js`)

**Architecture:** 6-node directed graph with conditional routing

```
EXTRACT → CHECK_GOAL → (ASK_GOAL OR CHECK_REQUIREMENTS) → (ASK_INFO OR EXECUTE_TOOL) → END
```

#### Node 1: EXTRACT
**Purpose:** Parse user message and update permanent memory

**Process:**
1. Build dynamic prompt that locks already-known fields
2. Call Extractor LLM to extract: `{ model, part, symptoms, goal, email }`
3. Update state with "write-once" strategy:
   - Model/Part/Goal: Only update if newly extracted (never overwrite with null)
   - Symptoms: Accumulate (never clear)
   - Email: Update if provided

**Key Logic:**
```javascript
// Lock fields that already exist in memory
const modelInstruction = productModel 
  ? `ALWAYS return null (already known: ${productModel})`
  : `extract appliance model or null`;
```

#### Router 1: CHECK_GOAL
**Purpose:** Determine if user has specified what they need

**Logic:**
- If `goalType` exists → Route to `check_requirements`
- Else → Route to `ask_goal`

**Trigger Words by Goal:**
- `diagnose_repair`: fix, troubleshoot, diagnose, what's wrong, repair
- `install_instruction`: install, how to install, replacement, replace
- `check_compatibility`: compatible, will work, fit
- `email_summary`: save, email, send, share, forward, email me

#### Node 2: ASK_GOAL
**Purpose:** Ask user what help they need

**Behavior:**
- Speaker LLM generates friendly question
- Mentions all 4 tool options
- Returns to end (user must specify goal in next message)

#### Router 2: CHECK_REQUIREMENTS
**Purpose:** Validate all required fields are in memory

**Requirements by Goal:**
```javascript
{
  install_instruction: { model: true, part: true },
  check_compatibility: { model: true, part: true },
  diagnose_repair: { model: true, symptoms: true },
  email_summary: { email: true }
}
```

**Logic:**
- If missing fields → Route to `ask_info`
- Else → Route to `execute_tool`

#### Node 3: ASK_INFO
**Purpose:** Request missing information from user

**Behavior:**
- Speaker LLM asks for ONLY the missing fields
- Goal-specific prompts ensure one-sentence questions
- Returns to end (user provides info in next message)

#### Node 4: EXECUTE_TOOL
**Purpose:** Call appropriate tool and render result

**Tool Selection:**
```javascript
if (goalType === "diagnose_repair") → call diagnosisTool(model, symptoms)
if (goalType === "install_instruction") → call getInstallationsTool(partNumber, model)
if (goalType === "check_compatibility") → call checkCompatibilityTool(partNumber, model)
if (goalType === "email_summary") → call emailSummaryTool(email, conversationSummary)
```

**Post-Execution:**
1. Parse tool result to JSON
2. Pass to Speaker LLM to render response
3. Store `lastToolResult` for frontend rendering
4. **Clear `goalType: null`** to allow next tool usage
5. Return to end

### 3. Four Core Tools (`tools.js`)

#### Tool 1: diagnose_repair
**Input:** `{ model: string, symptoms: string[] }`
**Output:** Top 3 parts that solve the symptoms
**Process:**
- Normalize user symptoms (handle curly quotes, apostrophes)
- Match against parts database `solves_symptoms` field
- Return with images and prices

#### Tool 2: check_compatibility
**Input:** `{ partNumber: string, model: string }`
**Output:** Boolean + message
**Process:**
- Check if part exists in model's parts list
- Return compatibility status

#### Tool 3: get_installation_instructions
**Input:** `{ partNumber: string, model: string }`
**Output:** YouTube video URL + part details
**Process:**
- Fetch part data from database
- Return `repair_video_url` for embedding
- Include part name, price, installation steps

#### Tool 4: email_summary
**Input:** `{ email: string, conversationSummary: string }`
**Output:** Success/failure status
**Process:**
1. Clean conversation summary (remove JSON, URLs, code blocks)
2. Parse for YouTube video URLs and image URLs
3. Format as professional HTML email with:
   - Brand colors (#337778 teal, #f3c04c gold)
   - Conversation summary with headings and lists
   - Links to videos and images
4. Send via Gmail SMTP (Nodemailer)

**Email Structure:**
```html
Header (teal background)
├─ Logo
└─ "PartSelect Support Summary"

Content (white background)
├─ Intro paragraph
├─ Formatted conversation summary
├─ Video links section (if any)
└─ Images section (if any)

Footer (light gray)
├─ Help link to partselect.com
└─ Auto-generated email notice
```

### 4. State Schema (`state.js`)

```javascript
type AgentStateAnnotation = {
  // User input/output
  userMessage: string;
  messages: Message[];
  finalResponse: string;
  
  // Persistent memory (locked once set)
  productModel: string | null;
  partNumber: string | null;
  goalType: string | null;
  
  // Accumulated data
  symptoms: string[];
  emailAddress: string | null;
  
  // Transient data
  lastExtraction: Object;
  lastToolResult: { toolName, data };
  missingInfo: string[];
}
```

### 5. Agent Orchestration (`agent.js`)

**Flow:**
1. Build input from session state
2. Run graph.invoke(input)
3. Extract final response from messages
4. Update session with all new state
5. Return `{ response, toolData }`

**Memory Preservation:**
```javascript
// Never overwrite with undefined - always preserve
sessionState.productModel = output.productModel !== undefined 
  ? output.productModel 
  : sessionState.productModel;
```

## Data Schema

### Parts Database (`data/parts.json`)

```javascript
{
  "WDT780SAEM1": {  // Model number
    "parts": {
      "PS3406971": {  // Part number
        "name": "Control Board",
        "price": 249.99,
        "description": "...",
        "image_url": "https://...",
        "repair_video_url": "https://www.youtube.com/embed/...",
        "solves_symptoms": [
          "Will Not Start",
          "Not cleaning dishes properly"
        ]
      }
    }
  }
}
```

## Memory Strategy

**Write-Once Pattern:**
- Model, Part, Goal: Locked once extracted (prevents accidental overwriting)
- Symptoms: Accumulated (can add more throughout conversation)
- Email: Updated if provided by user

**Goal Reset:**
- Explicitly set to `null` after tool execution
- Allows user to specify new tool in next message without repeating model/part

**Example Flow:**
```
User: "My WDT780SAEM1 dishwasher won't start"
→ Extract: model=WDT780SAEM1, goal=diagnose_repair, symptoms=[Will Not Start]
→ Ask for more symptoms (has model, but diagnose needs symptoms)

User: "It also won't drain"
→ Extract: symptoms accumulate = [Will Not Start, Not draining]
→ Execute diagnosis tool (all requirements met)
→ Clear goal=null

User: "Can you check if PS3406971 works?"
→ Extract: goal=check_compatibility, part=PS3406971
→ Execute compatibility tool
→ Clear goal=null

User: "Email me the summary"
→ Extract: goal=email_summary, email=user@example.com
→ Execute email tool
→ Done
```

## Environment Configuration

**`.env` file required:**
```
OPENAI_API_KEY=sk_...
EMAIL_USER=bot.part.select@gmail.com
EMAIL_PASSWORD=<gmail_app_password>
PORT=3001
```

**Email Setup:**
- Service: Gmail SMTP
- Authentication: Gmail app-specific password (not regular password)
- Lazy loading: Transporter initialized on first email send

## Key Algorithms

### Symptom Matching (diagnoseFromSymptoms)

1. **Normalization:** Convert curly quotes and apostrophes to standard characters
2. **Exact Matching:** Compare normalized user symptoms with parts' `solves_symptoms`
3. **Ranking:** Return all matches (no scoring)
4. **Limiting:** Keep only top 3 parts

```javascript
const normalizeString = (str) => {
  return str.replace(/['']/g, "'").toLowerCase().trim();
};

// Check if user's normalized symptom matches any part symptom
const hasMatch = normalizedUserSymptoms.some(userSymptom =>
  partSymptoms.some(partSymptom => 
    normalizeString(partSymptom) === userSymptom
  )
);
```

### Goal Detection

- No inherent priority (first matching trigger word wins)
- Must appear in **current message only** (not memory)
- Locked once set (cannot change goal mid-conversation without reset)

## Performance Considerations

- **LLM Calls:** 1 extraction per user message + 1 speaker response per node
- **Database Lookups:** O(n) for part matching (n = parts for model)
- **Session Memory:** In-memory storage (productionize with database)
- **Email:** Async, uses Nodemailer connection pooling

## Error Handling

- **Missing Model:** Error message sent to user, no tool execution
- **Invalid Email:** Email tool returns error JSON, user sees message
- **LLM Parse Failure:** Fallback to empty extraction, flow continues
- **Tool Execution Failure:** Error caught, goal still cleared, user sees error message

## Testing

**Test Files in `backend/tests/`:**
- `test-agent-v2.js` - Full agent flow with multiple turns
- `test-memory-persistence.js` - Memory preservation across turns
- `test-goal-preservation.js` - Goal locking behavior
- `test-session-issue.js` - Session state consistency

**Run tests:**
```bash
cd backend
node tests/test-agent-v2.js
```

## Production Checklist

- [ ] Replace in-memory sessions with database (MongoDB/PostgreSQL)
- [ ] Implement rate limiting for API endpoints
- [ ] Add request validation and sanitization
- [ ] Set up proper error logging (Winston/Bunyan)
- [ ] Cache parts database (Redis)
- [ ] Implement conversation persistence/archiving
- [ ] Add user authentication
- [ ] Set up monitoring and alerting (Sentry)
- [ ] Load test with multiple concurrent sessions
- [ ] Implement retry logic for email sending

## Architecture Diagram

```
┌─────────────────────────────────────┐
│         Express Server              │
│         (server.js)                 │
│  POST /api/chat → Session Mgmt      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Agent Orchestrator             │
│      (agent.js)                     │
│  Builds input, runs graph, updates  │
│  session state                      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      LangGraph State Machine        │
│      (graph.js)                     │
│                                     │
│  EXTRACT → CHECK_GOAL → ASK_GOAL    │
│     │                               │
│     └─→ CHECK_REQ → ASK_INFO        │
│              │                      │
│              └─→ EXECUTE_TOOL       │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┬──────────┬──────────┐
        ▼             ▼          ▼          ▼
   ┌────────┐  ┌─────────┐ ┌────────┐ ┌─────────┐
   │Diagnose│  │Install  │ │Compat  │ │  Email  │
   │Tool    │  │Tool     │ │Tool    │ │  Tool   │
   └────────┘  └─────────┘ └────────┘ └─────────┘
        │             │          │          │
        └─────────────┴──────────┴──────────┘
               │
               ▼
   ┌─────────────────────────────┐
   │  Parts Database             │
   │  (data/parts.json)          │
   │  Models → Parts → Symptoms  │
   └─────────────────────────────┘
```

## Frontend Integration

Frontend sends:
- `message`: User text input
- `sessionId`: (optional) Previous session ID

Backend returns:
- `message`: Agent response
- `sessionId`: For persistence
- `toolData`: `{ toolName, data }` for rendering videos/images

**Tool Data Structure:**
```javascript
{
  toolName: "diagnose_repair" | "install_instruction" | "check_compatibility" | "email_summary",
  data: {
    // Varies by tool
    suggestedParts: [...],  // for diagnose
    videoUrl: "...",        // for install
    success: true,          // for email
    ...
  }
}
```
