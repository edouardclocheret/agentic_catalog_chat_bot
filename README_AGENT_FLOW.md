# PartSelect Assistant - Agent Behavior & Flow Diagrams

## Quick Start

1. **Backend:** `cd backend && npm start` (Port 3001)
2. **Frontend:** `npm start` (Port 3000)
3. **Test:** Visit http://localhost:3000

## Core Agent Flow

### High-Level State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    USER MESSAGE                             │
│              "My dishwasher won't start"                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │   EXTRACT NODE            │
         │                           │
         │ Parse message with        │
         │ Extractor LLM (temp 0.1)  │
         │                           │
         │ Extract:                  │
         │ • model: WDT780SAEM1      │
         │ • symptoms: [Won't Start] │
         │ • goal: diagnose_repair   │
         └────────────┬──────────────┘
                      │
                      ▼
         ┌───────────────────────────┐
         │  CHECK GOAL ROUTER        │
         │                           │
         │ Is goalType set?          │
         │ YES → check requirements  │
         │ NO  → ask goal            │
         └────────────┬──────────────┘
                      │ (goal exists)
                      ▼
         ┌───────────────────────────┐
         │ CHECK REQUIREMENTS ROUTER │
         │                           │
         │ For diagnose_repair:      │
         │ ✓ model (have)            │
         │ ✓ symptoms (have)         │
         │                           │
         │ All met? YES → execute    │
         └────────────┬──────────────┘
                      │
                      ▼
         ┌───────────────────────────┐
         │  EXECUTE TOOL NODE        │
         │                           │
         │ Call: diagnosisTool()     │
         │                           │
         │ Get top 3 parts:          │
         │ 1. Control Board $249.99  │
         │ 2. Thermal Fuse $39.99    │
         │ 3. Power Cord $24.99      │
         │                           │
         │ Speaker LLM renders:      │
         │ "Found 3 parts that..."   │
         │                           │
         │ Clear: goalType = null    │
         └────────────┬──────────────┘
                      │
                      ▼
         ┌───────────────────────────┐
         │    RETURN RESPONSE        │
         │                           │
         │ Message + Parts Grid      │
         │ + Tool Badge              │
         │ + Images                  │
         └───────────────────────────┘
```

## Detailed State Transitions

### Scenario 1: Complete Diagnosis (Happy Path)

```
Turn 1: USER
  Input: "My WDT780SAEM1 won't start"
  
  Flow:
  extract() → extracts model, goal=diagnose_repair
    │
  checkGoalRouter() → goal exists → check_requirements
    │
  checkRequirementsRouter() → MISSING symptoms → ask_info
    │
  askInfoNode() → Speaker asks for symptoms
    │
  Output: "What symptoms are you experiencing?"

Turn 2: USER
  Input: "It won't turn on and there's no light"
  
  Flow:
  extract() → accumulates symptoms: [Won't Start]
    │
  checkGoalRouter() → goal exists → check_requirements
    │
  checkRequirementsRouter() → ALL FOUND → execute_tool
    │
  executeToolNode() → diagnosisTool(model, symptoms)
    │
    └─→ Returns:
        {
          model: "WDT780SAEM1",
          symptoms: ["Will Not Start"],
          suggestedParts: [
            {
              partNumber: "PS3406971",
              name: "Control Board",
              price: 249.99,
              image_url: "https://...",
              solves_symptoms: ["Will Not Start"]
            },
            ...
          ]
        }
    │
  Speaker LLM renders result
  goalType = null (CLEARED)
    │
  Output: 
    "I found 3 parts that could fix your issue..."
    [Shows 3-column parts grid with images]
    [Shows green "APPROVED" badge]
```

### Scenario 2: Sequential Tool Usage

```
Turn 1: diagnose_repair
  ✓ Goal set
  ✓ Part results shown
  ✓ goalType cleared to NULL

Turn 2: USER says "Install PS3406971"
  
  Flow:
  extract() → extracts goal=install_instruction, part=PS3406971
    │
  checkGoalRouter() → goal exists → check_requirements
    │
  checkRequirementsRouter() → ALL FOUND → execute_tool
    │
  executeToolNode() → getInstallationsTool()
    │
  Output: YouTube video embedded + text
  goalType cleared to NULL

Turn 3: USER says "Email me this"
  
  Flow:
  extract() → extracts goal=email_summary, email (if provided)
    │
  checkGoalRouter() → goal exists → check_requirements
    │
  checkRequirementsRouter() → MISSING email → ask_info
    │
  askInfoNode() → Asks for email address
    │
  Output: "What's your email address?"

Turn 4: USER provides email
  
  Flow:
  extract() → updates emailAddress
    │
  checkGoalRouter() → goal exists → check_requirements
    │
  checkRequirementsRouter() → ALL FOUND → execute_tool
    │
  executeToolNode() → emailSummaryTool()
    │
    └─→ Sends professional HTML email with:
        • Conversation summary
        • Video links
        • Part images
        • All formatted with brand colors
    │
  Output: "Email sent to user@example.com ✓"
  goalType cleared to NULL
```

## Memory Persistence Strategy

### Write-Once Fields (Locked)

```
Turn 1: "My WDT780SAEM1..."
  productModel = "WDT780SAEM1"  ← LOCKED

Turn 2: "Actually it's LFX31945..."
  productModel = "WDT780SAEM1"  ← STAYS (won't overwrite)
```

### Accumulated Fields

```
Turn 1: "It won't start and is noisy"
  symptoms = ["Will Not Start", "Noisy"]

Turn 2: "Also leaking water"
  symptoms = ["Will Not Start", "Noisy", "Leaking"]  ← ACCUMULATED
```

### Reset Fields (Cleared After Each Tool)

```
Tool execution complete:
  goalType = null  ← RESET to allow next tool

Next user message:
  Can specify new goal (diagnose, install, email, etc.)
```

## Node-by-Node Behavior

### EXTRACT Node

```
Input: userMessage
Process:
  1. Build dynamic prompt locking known fields
  2. Call Extractor LLM:
     {
       "model": "WDT780SAEM1" or null,
       "part": "PS3406971" or null,
       "symptoms": ["Won't Start"],
       "goal": "diagnose_repair" or null,
       "email": "user@example.com" or null
     }
  3. Update state:
     • If extracted non-null, update memory
     • If null, preserve existing value
  4. Accumulate symptoms (never clear)
Output: Updated state + lastExtraction
```

### CHECK_GOAL Router

```
if (goalType && goalType !== "")
  → "check_requirements" (goal exists, proceed)
else
  → "ask_goal" (ask user what they want)

Trigger words detected in current message:
  "fix" / "troubleshoot" / "diagnose" / "what's wrong" / "repair"
    → goal = "diagnose_repair"
  
  "install" / "how to install" / "replacement" / "replace"
    → goal = "install_instruction"
  
  "compatible" / "will work" / "fit"
    → goal = "check_compatibility"
  
  "save" / "email" / "send" / "share" / "forward" / "email me"
    → goal = "email_summary"
```

### ASK_GOAL Node

```
Input: No goal in memory
Process:
  1. Speaker LLM generates question
  2. Mentions all 4 tool options
Output: Friendly question asking what user needs
Route: Back to __end__ (wait for user's next message)

Example output:
  "I can help you with:
   • Diagnosing problems and finding parts
   • Installing parts with video guides
   • Checking part compatibility
   • Emailing a summary of our chat
   
   What would you like help with?"
```

### CHECK_REQUIREMENTS Router

```
Requirements by goal:

diagnose_repair needs:
  ✓ productModel
  ✓ symptoms (at least 1)
  → If all present: execute
  → If missing: ask for missing items

install_instruction needs:
  ✓ productModel
  ✓ partNumber
  → If all present: execute
  → If missing: ask for missing items

check_compatibility needs:
  ✓ productModel
  ✓ partNumber
  → If all present: execute
  → If missing: ask for missing items

email_summary needs:
  ✓ emailAddress
  → If present: execute
  → If missing: ask for missing items
```

### ASK_INFO Node

```
Input: List of missing fields
Process:
  1. Build goal-specific prompt
  2. Speaker LLM asks for missing items (1 sentence max)
Output: Question asking for specific missing info
Route: Back to __end__ (wait for user to provide info)

Example outputs:
  [diagnose_repair missing symptoms]
  "What issues are you experiencing with it?"
  
  [install_instruction missing partNumber]
  "What's the part number you want to install?"
  
  [email_summary missing email]
  "What email address should I send it to?"
```

### EXECUTE_TOOL Node

```
Input: All requirements met
Process:
  1. Select tool based on goalType:
     - diagnose_repair → diagnosisTool
     - install_instruction → getInstallationsTool
     - check_compatibility → checkCompatibilityTool
     - email_summary → emailSummaryTool
  
  2. Call tool with required parameters
  
  3. Parse result (JSON or string)
  
  4. Speaker LLM renders tool result
  
  5. Store in lastToolResult:
     {
       toolName: "diagnose_repair",
       data: { ... parsed result ... }
     }
  
  6. CRITICAL: Set goalType = null
     (Allows next message to specify new goal)

Output: Rendered response + toolData
Route: __end__ (done with this turn)
```

## Data Flow Example: Diagnosis Request

```
┌──────────────────────────────────────────────────┐
│ User Input                                       │
│ "My WDT780SAEM1 dishwasher won't turn on"       │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
        ┌─────────────────────────────┐
        │ Extractor LLM (temp 0.1)    │
        │ Structured extraction       │
        └─────────────┬───────────────┘
                      │
                      ▼
           ┌────────────────────────┐
           │ Extracted Data         │
           │ {                      │
           │  model: WDT780SAEM1,   │
           │  symptoms: [Won't...], │
           │  goal: diagnose_repair │
           │ }                      │
           └─────────────┬──────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │ Diagnosis Tool Logic   │
              │                        │
              │ 1. Normalize symptoms  │
              │ 2. Search parts DB     │
              │ 3. Match symptoms      │
              │ 4. Return top 3        │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Top 3 Parts Array      │
              │ [                      │
              │   {                    │
              │     partNumber: PS..., │
              │     name: Control...,  │
              │     price: 249.99,     │
              │     image_url: https..│
              │   },                   │
              │   ...                  │
              │ ]                      │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Speaker LLM (temp 0.7) │
              │ Render recommendation  │
              └────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Frontend Display                     │
        │                                      │
        │ "I found 3 parts that might help..." │
        │                                      │
        │ [Parts Grid 3 columns]               │
        │ ┌─────────────┐ ┌────────────┐     │
        │ │ Image       │ │ Image      │     │
        │ │ Control..   │ │ Thermal... │     │
        │ │ $249.99     │ │ $39.99     │     │
        │ └─────────────┘ └────────────┘     │
        │                                      │
        │ [✓ APPROVED by PartSelect Diagnosis]│
        └──────────────────────────────────────┘
```

## Email Flow

```
User: "Email me the summary"
│
├─ Extract goal=email_summary
│
├─ Request emailAddress
│
├─ User provides: "user@example.com"
│
├─ Execute emailSummaryTool(email, conversationSummary)
│  │
│  ├─ Clean summary (remove JSON, code blocks)
│  │
│  ├─ Parse for URLs:
│  │  ├─ YouTube embeds → Extract video IDs
│  │  └─ Images (.jpg, .png) → Extract URLs
│  │
│  ├─ Format as HTML:
│  │  ├─ Header (teal #337778)
│  │  ├─ Conversation summary
│  │  ├─ Video links section
│  │  ├─ Images grid
│  │  └─ Footer
│  │
│  └─ Send via Gmail SMTP
│     ├─ From: bot.part.select@gmail.com
│     ├─ To: user@example.com
│     └─ Subject: "Your PartSelect Support Summary"
│
└─ Response: "✓ Email sent to user@example.com"
```

## Error Recovery

```
┌─ Model not in database
│  └─ Extraction fails
│  └─ Tool returns error message
│  └─ User sees: "Model not found, please check..."
│
├─ Missing required field
│  └─ CHECK_REQUIREMENTS routes to ASK_INFO
│  └─ ASK_INFO asks for field
│  └─ User provides
│  └─ EXTRACT updates state
│  └─ EXECUTE_TOOL now has all requirements
│
├─ LLM parse error
│  └─ Fallback to empty extraction
│  └─ State preserved
│  └─ Flow continues normally
│
├─ Email send failure
│  └─ Catch error
│  └─ Return error message
│  └─ Goal still cleared
│  └─ User can retry or continue
│
└─ Tool execution error
   └─ Error caught
   └─ Error message returned to user
   └─ Goal cleared (can specify new goal)
```

## State Lifecycle

```
SESSION CREATED
│
├─ productModel: null
├─ partNumber: null
├─ symptoms: []
├─ goalType: null
├─ emailAddress: null
│
TURN 1: User specifies model + goal
│
├─ productModel: "WDT780SAEM1"  ← LOCKED
├─ symptoms: ["Won't Start"]     ← ACCUMULATED
├─ goalType: "diagnose_repair"
│  │
│  ├─ Tool executed
│  ├─ Response rendered
│  └─ goalType: null             ← CLEARED
│
TURN 2: User asks for email
│
├─ productModel: "WDT780SAEM1"  ← STILL LOCKED
├─ symptoms: ["Won't Start"]     ← STILL THERE
├─ goalType: "email_summary"     ← NEW
├─ emailAddress: "user@email.com"
│  │
│  ├─ Tool executed
│  ├─ Email sent
│  └─ goalType: null             ← CLEARED AGAIN
│
TURN 3: User asks for installation
│
├─ productModel: "WDT780SAEM1"  ← STILL LOCKED
├─ goalType: "install_instruction"
├─ partNumber: "PS3406971"
│  │
│  ├─ Tool executed
│  ├─ Video shown
│  └─ goalType: null
```

## Key Insights

1. **Two-LLM Strategy:**
   - Extractor (temp 0.1): Silent, deterministic JSON extraction
   - Speaker (temp 0.7): Natural, engaging user responses

2. **Memory Locks:**
   - Prevent accidental overwriting of model/part
   - Force explicit user confirmation to change

3. **Goal Clearing:**
   - Enable sequential tool usage in same session
   - Users can go: diagnose → install → email without re-authenticating

4. **Symptom Accumulation:**
   - Builds understanding over time
   - Can ask "also having X?" and it adds to list

5. **Conditional Routing:**
   - Simple state checks (presence of fields)
   - No complex business logic in routers
   - Flexibility to add new requirements per goal

## Performance Characteristics

```
Message processing time:
  Extraction LLM call:        ~0.5-1s
  Speaker LLM call:           ~0.5-1s
  Tool execution:             ~0.1-0.2s (DB lookup)
  Email sending:              ~1-2s (SMTP)
  ─────────────────────────────────────
  Total per turn:             ~1.5-2s

Database operations:
  Part matching:              O(n) where n = parts per model (~100)
  Model lookup:               O(1)
  
Session memory:
  In-memory per session:      ~1KB
  Max concurrent (16GB RAM):  ~15 million sessions
```
