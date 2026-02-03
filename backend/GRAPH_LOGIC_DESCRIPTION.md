# Graph-V2 Logic Description

## Overview

Your graph is a **memory-aware, slot-filling agent** built with LangGraph that assists users with appliance support by extracting information, validating requirements, and executing appropriate tools.

The graph follows a **persistent memory model** where information is extracted once and locked, never reset between turns within a session.

---

## Core Principles

### 1. **Persistent Memory (Write-Once)**
- Once `model`, `part`, or `goal` are extracted and set, they are **LOCKED** in memory
- The LLM is explicitly instructed to return `null` for locked fields (via dynamic prompt)
- **Memory can ONLY be updated by non-null LLM extractions**
- If LLM returns `null`, the existing memory value is **NEVER replaced**
- Only `symptoms` continue to accumulate (never replaced, always added)
- Memory never resets between turns in the same session

### 2. **Memory-First Decision Making**
- All decisions (routing) are based on **what's in memory**, not what was just extracted
- This ensures consistent behavior regardless of what the user says

### 3. **Slot-Filling Pattern**
- Specific goals require specific slots (fields) to be filled
- The graph validates all required slots are present before executing tools

---

## Graph Flow Diagram

```
[USER MESSAGE]
      ↓
  [EXTRACT NODE] ← Always starts here
      ↓
  Parse user message with LLM
  Update memory (preserve locked fields)
      ↓
  [CHECK GOAL ROUTER]
      ├─ If NO goal in memory → [ASK_GOAL] → End (user responds later)
      └─ If goal exists → [CHECK_REQUIREMENTS ROUTER]
                          ├─ If requirements missing → [ASK_INFO] → End (user responds later)
                          └─ If all requirements met → [EXECUTE_TOOL] → End
```

---

## Nodes Explained

### 1. **EXTRACT NODE** - LLM-powered information extraction

**What it does:**
- Parses the user message with GPT-4o-mini
- Builds a dynamic prompt that tells the LLM which fields are already locked
- Updates memory based on extraction

**Key Logic:**

```javascript
// Dynamic prompt tells LLM what to extract
if (hasModel) → LLM sees "goal: ALWAYS return null (already locked)"
if (hasPart) → LLM sees "part: ALWAYS return null (already locked)"
if (hasGoal) → LLM sees "goal: ALWAYS return null (already locked)"
```

**Memory Update Strategy:**
```
For each field (model, part, goal, symptoms):
  IF LLM extracted a NON-NULL value
    → UPDATE memory with the new value
  ELSE (LLM returned null or undefined)
    → KEEP existing memory value UNCHANGED
    → Never replace memory with null
```

**Important:** Memory is ONE-WAY. Once a field is set, it can ONLY be updated with a new non-null value. It can never be erased or reset to null by the LLM returning null.

**Outcome:** Returns updated state with `lastExtraction` recorded

---

### 2. **CHECK GOAL ROUTER** - Conditional routing based on goal

**Question:** Is there a goal in memory?

**Logic:**
```javascript
if (!state.goalType) {
  return "ask_goal"      // No goal → ask user what they want
} else {
  return "check_requirements"  // Goal exists → check if we have what we need
}
```

**Two paths:**
- **No goal** → Route to `ask_goal` node
- **Goal exists** → Route to `check_requirements` validation

---

### 3. **ASK_GOAL NODE** - Request user's intention

**What it does:**
- Presents user with 4 options:
  1. Install a part
  2. Check part compatibility
  3. Diagnose and fix problems
  4. Find parts

**Outcome:** 
- Sends response to user
- Ends turn (graph ends, returns to user)
- Next turn will extract the goal from user's response

**Key:** Preserves ALL existing memory (model, part, symptoms if any)

---

### 4. **CHECK REQUIREMENTS ROUTER** - Validates if we have everything needed

**Question:** Does the current goal have all required information?

**Requirements by Goal:**

| Goal | Requires Model | Requires Part | Requires Symptoms |
|------|---|---|---|
| `install_instruction` | ✓ | ✓ | ✗ |
| `check_compatibility` | ✓ | ✓ | ✗ |
| `diagnose_repair` | ✓ | ✗ | ✓ |

**Logic:**
```javascript
const requirements = {
  install_instruction: { model: true, part: true, symptoms: false },
  check_compatibility: { model: true, part: true, symptoms: false },
  diagnose_repair: { model: true, part: false, symptoms: true }
};

// Check what's missing
missing = [];
if (needed.model && !hasModel) missing.push("appliance model");
if (needed.part && !hasPart) missing.push("part number");
if (needed.symptoms && !hasSymptoms) missing.push("symptoms");

if (missing.length > 0) {
  return "ask_info"        // Missing fields → ask for them
} else {
  return "execute_tool"    // All requirements met → execute tool
}
```

**Two paths:**
- **Missing fields** → Route to `ask_info` node
- **All fields present** → Route to `execute_tool` node

---

### 5. **ASK_INFO NODE** - Request missing information

**What it does:**
- Identifies what's missing: "To help you with [goal], I need:"
- Asks specifically for missing fields:
  - Model: "Your appliance model number (e.g., WDT780SAEM1)"
  - Part: "The part number (e.g., PS3406971)"
  - Symptoms: "What problems you're experiencing"

**Outcome:**
- Sends request to user
- Ends turn (graph ends, returns to user)
- Next turn will extract the missing info and re-run from EXTRACT

**Key:** Preserves ALL existing memory

---

### 6. **EXECUTE_TOOL NODE** - Calls appropriate tool with memory data

**What it does:**
- Selects tool based on goal type
- Calls tool with data from memory
- Returns tool result to user

**Tool Selection:**

```javascript
if (goalType === "diagnose_repair") {
  toolName = "diagnose_repair"
  input = { model: productModel, symptoms }
  
} else if (goalType === "install_instruction") {
  toolName = "get_installation_instructions"
  input = { partNumber, model: productModel }
  
} else if (goalType === "check_compatibility") {
  toolName = "check_compatibility"
  input = { partNumber, model: productModel }
}
```

**Outcome:**
- Executes the tool
- Returns result in `finalResponse`
- Ends turn (graph ends, returns to user with result)
- **Memory is fully preserved** for next turn

---

## State Management

### Persistent State Fields

All of these flow through the graph and are preserved:

```javascript
{
  // Input
  userMessage: string,
  
  // Permanent Memory (LOCKED once set)
  productModel: string | null,
  partNumber: string | null,
  goalType: string | null,
  
  // Accumulating Data
  symptoms: string[],
  messages: array,
  
  // Tracking
  lastExtraction: { model, part, goal, symptoms },
  missingInfo: string[]
}
```

### Memory Preservation at Agent Level

After graph execution:
```javascript
// In agent-v2.js:
sessionState.goalType = output.goalType !== undefined 
  ? output.goalType 
  : sessionState.goalType;  // Preserve if undefined
```

**This ensures:** If a node doesn't update `goalType`, the session keeps its value

---

## Example Conversation Flow

### User: "I need to install a part for my WDT780SAEM1"

```
[EXTRACT] 
  Extracted: { model: "WDT780SAEM1", goal: "install_instruction" }
  Memory: { model: "WDT780SAEM1", goal: "install_instruction" }

[CHECK_GOAL_ROUTER]
  Goal exists in memory → go to check_requirements

[CHECK_REQUIREMENTS]
  Required: model ✓, part ✗
  Missing: part number → go to ask_info

[ASK_INFO]
  Response: "To help you with install_instruction, I need: part number"
  [GRAPH ENDS]
```

### User: "The part is PS3406971"

```
[EXTRACT]
  State at start: { model: "WDT780SAEM1", goal: "install_instruction" }
  Extracted: { part: "PS3406971" }
  Memory: { model: "WDT780SAEM1", goal: "install_instruction", part: "PS3406971" }

[CHECK_GOAL_ROUTER]
  Goal exists → go to check_requirements

[CHECK_REQUIREMENTS]
  Required: model ✓, part ✓
  All present → go to execute_tool

[EXECUTE_TOOL]
  Call: get_installation_instructions({ partNumber: "PS3406971", model: "WDT780SAEM1" })
  Response: Installation video and details
  [GRAPH ENDS]
```

### User: "I also have a leaking problem"

```
[EXTRACT]
  State: { model: "WDT780SAEM1", goal: "install_instruction", part: "PS3406971" }
  Extracted: { symptoms: ["leaking"] }
  Memory: { model: "WDT780SAEM1", goal: "install_instruction", part: "PS3406971", symptoms: ["leaking"] }

[CHECK_GOAL_ROUTER]
  Goal exists → go to check_requirements

[CHECK_REQUIREMENTS]
  Required: model ✓, part ✓ (note: symptoms not required for install_instruction)
  All present → go to execute_tool

[EXECUTE_TOOL]
  Call: get_installation_instructions(...)
  Response: Installation video (goal remains install_instruction)
  [GRAPH ENDS]
```

---

## Key Advantages

1. **Memory Lock System**
   - Once extracted, information cannot be accidentally reset
   - LLM respects locked fields via prompt engineering

2. **Slot-Filling Validation**
   - Ensures tools only run when they have required data
   - Prevents partial/incomplete executions

3. **Multi-Turn Consistency**
   - Session-based memory persists across turns
   - Same goal and preferences maintained throughout conversation

4. **Symptom Accumulation**
   - Unique among fields: symptoms keep adding up
   - Useful for diagnostic scenarios where problems compound

5. **Clear Decision Points**
   - Conditional routers make flow explicit
   - Easy to understand what triggers each branch

---

## Error Handling

- **Parse Errors:** If LLM response isn't valid JSON, extraction continues with defaults
- **Unknown Goal:** If goal doesn't match any requirements, asks for clarification
- **Tool Failure:** Returns error message, preserves memory for retry

---

## Summary

Your graph implements a **robust slot-filling agent** with:
- ✅ Persistent, locked memory
- ✅ Goal-driven routing
- ✅ Requirement validation
- ✅ Multi-turn conversations
- ✅ LLM-powered extraction with smart prompting
