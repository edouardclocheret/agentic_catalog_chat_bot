# Graph V2 - Visual Flow Reference

## Complete Graph Structure (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AGENT START                                │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   📥 EXTRACT NODE                                   │
│                                                                      │
│  What it does:                                                       │
│  • Parse user message                                              │
│  • Extract: model, part, symptoms, goal                           │
│  • Add to PERMANENT MEMORY (never remove)                         │
│                                                                      │
│  Example:                                                           │
│  Input: "My WDT780SAEM1 is leaking"                              │
│  Output: {                                                          │
│    model: "WDT780SAEM1",                                          │
│    symptoms: ["leaking"],                                         │
│    goal: null                                                      │
│  }                                                                  │
│  Memory: ✓ Model saved, ✓ Symptoms saved                         │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Goal in memory?      │
        │ (NOT LLM - code!)    │
        └──────┬───────────┬───┘
               │           │
          ❌ NO│           │✅ YES
               │           │
               ▼           ▼
    ┌─────────────────┐  ┌──────────────────────────┐
    │  🎯 ASK_GOAL    │  │ 🔍 CHECK_REQUIREMENTS    │
    │   NODE          │  │    ROUTER                │
    │                 │  │                          │
    │ "What would     │  │ For this goal, what      │
    │  you like to    │  │ fields do we need?       │
    │  do?"           │  │                          │
    │                 │  │ Examples:                │
    │ 1. Install      │  │ • install: model + part  │
    │ 2. Check compat │  │ • diagnose: model + syms │
    │ 3. Diagnose     │  │ • compatibility: model + │
    │ 4. Find parts   │  │   part                   │
    └────────┬────────┘  └──────┬────────┬──────────┘
             │                  │        │
             │            ✅ALL │        │❌MISSING
             │                  │        │
             │                  ▼        ▼
             │          ┌────────────────────┐
             │          │  ℹ️  ASK_INFO NODE │
             │          │                    │
             │          │ "I need:"          │
             │          │ - Model number     │
             │          │ - Part number      │
             │          │ - Symptoms         │
             │          │ (only missing ones)│
             │          └────────┬───────────┘
             │                   │
             │              ❌ END
             │          (wait for user)
             │                   │
             │      ┌────────────┘
             │      │ (User provides info)
             │      │ → Loop back to EXTRACT
             │      │ → Flow continues
             │      │
             │ END  ▼
             └─────→ (wait for user)
                    │
         ┌──────────┘
         │ (User replies with goal)
         │ → Loop back to EXTRACT
         │ → Flow continues
         │
         ▼ (from ASK_INFO or ASK_GOAL)
    ┌──────────────────────────────┐
    │   🔧 EXECUTE_TOOL NODE       │
    │                              │
    │ Determine tool for goal:     │
    │ • diagnose_repair            │
    │   → diagnose_repair(model,   │
    │      symptoms)               │
    │                              │
    │ • install_instruction        │
    │   → get_installation_         │
    │      instructions(part,      │
    │      model)                  │
    │                              │
    │ • check_compatibility        │
    │   → check_compatibility(     │
    │      part, model)            │
    │                              │
    │ Run tool, return results     │
    └──────────────┬───────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   ✅ AGENT END      │
        │                     │
        │ Return results to   │
        │ user               │
        └─────────────────────┘
```

## Decision Points Explained

### Router 1: Goal Check

```javascript
if (!state.goalType) {
  // No goal detected
  // → ASK_GOAL: "What would you like to do?"
  return "ask_goal";
} else {
  // Goal exists
  // → CHECK_REQUIREMENTS
  return "check_requirements";
}
```

**Input:** State with goalType field
**Output:** Path to take (ask_goal or check_requirements)
**Key:** This is pure code logic, NO LLM call

---

### Router 2: Requirements Check

```javascript
const requirements = {
  install_instruction: { model: true, part: true, symptoms: false },
  check_compatibility: { model: true, part: true, symptoms: false },
  diagnose_repair:     { model: true, part: false, symptoms: true }
};

const needed = requirements[state.goalType];
const missing = [];

if (needed.model && !state.productModel) missing.push("model");
if (needed.part && !state.partNumber) missing.push("part");
if (needed.symptoms && state.symptoms.length === 0) missing.push("symptoms");

if (missing.length > 0) {
  state.missingInfo = missing;
  return "ask_info";  // Ask for what's missing
} else {
  return "execute_tool";  // All fields present, execute
}
```

**Input:** State with goalType and extracted fields
**Output:** Path to take (ask_info or execute_tool)
**Key:** Requirements are explicit and unchanging

---

## Memory Preservation Examples

### Example 1: Accumulating Information

```
TURN 1:
User: "My WDT780SAEM1 is leaking"
Extract: model=WDT780SAEM1, symptoms=[leaking]
Memory After: {
  productModel: "WDT780SAEM1",
  symptoms: ["leaking"],
  goalType: null
}

TURN 2:
User: "It's also making noise"
Extract: symptoms=[noisy]
Memory After: {
  productModel: "WDT780SAEM1",
  symptoms: ["leaking", "noisy"],  ← ACCUMULATED!
  goalType: null
}

TURN 3:
User: "Fix it"
Extract: goal=diagnose_repair
Memory After: {
  productModel: "WDT780SAEM1",    ← STILL HERE
  symptoms: ["leaking", "noisy"],  ← STILL HERE
  goalType: "diagnose_repair"
}
```

### Example 2: Never Losing Part Number

```
TURN 1:
User: "Help me install PS3406971"
Extract: part=PS3406971, goal=install_instruction
Memory: part=PS3406971

TURN 2:
User: "What's the price?"  ← Doesn't mention part
Extract: part=null
Memory: part=PS3406971  ← KEPT! (merged, not replaced)

TURN 3:
User: "How do I install it?"
Already have: model, part, goal
→ Execute immediately
```

---

## Tool Execution Decision Tree

```
                    Tool Needed?
                         │
         ┌───────────────┬┴────────────────┐
         │               │                 │
    diagnose    check_compatibility   install_instr
    _repair          _tool             uction
         │               │                 │
         ▼               ▼                 ▼
    diagnose_repair  check_compatibility  get_inst_
    (model,          (part, model)        instructions
     symptoms)                            (part, model)
         │               │                 │
         └───────────────┴─────────────────┘
                    │
                    ▼
             Execute Tool
             │
             ├─ Parse results
             ├─ Format response
             └─ Return to user
```

---

## Conversation State Transition

```
Session State Object (Persistent):
{
  messages: [],              ← Grows each turn
  productModel: null,        ← Set once, persists
  partNumber: null,          ← Set once, persists
  symptoms: [],              ← Accumulates
  goalType: null             ← Set once, persists
}

TURN 1: "WDT780SAEM1 leaking"
  ├─ Extract → model, symptoms
  ├─ Update state: productModel=WDT780SAEM1, symptoms=[leaking]
  ├─ Router: No goal → ASK_GOAL
  └─ Return: "What would you like to do?"

TURN 2: "Fix it"
  ├─ Extract → goal=diagnose_repair
  ├─ Update state: goalType=diagnose_repair
  ├─ Router: Has goal, has fields → EXECUTE
  ├─ Tool: diagnose_repair(WDT780SAEM1, [leaking])
  └─ Return: [parts list]

TURN 3: (Same model, symptoms, goal persisted!)
  ├─ User mentions new symptom
  ├─ Extract → symptoms=[noisy]
  ├─ Update state: symptoms=[leaking, noisy]
  ├─ Router: Goal still diagnose_repair, has fields → EXECUTE
  ├─ Tool: diagnose_repair(WDT780SAEM1, [leaking, noisy])
  └─ Return: [updated parts list]
```

---

## Typical Conversation Flows

### Flow 1: User knows what they want (Shortest)

```
User: "Is PS3406971 compatible with WDT780SAEM1?"
   ↓
Extract: part=PS3406971, model=WDT780SAEM1, goal=check_compatibility
   ↓
Has all fields needed
   ↓
Execute: check_compatibility(PS3406971, WDT780SAEM1)
   ↓
Agent: "✓ Compatible"

Nodes hit: EXTRACT → EXECUTE
Time: ~1s (1 LLM call)
```

### Flow 2: Need goal clarification (Moderate)

```
User: "My dishwasher WDT780SAEM1 won't drain"
   ↓
Extract: model=WDT780SAEM1, symptoms=[not draining], goal=null
   ↓
No goal detected
   ↓
Agent: "What would you like to do? Install part / Check compat / Diagnose?"

User: "Diagnose it"
   ↓
Extract: goal=diagnose_repair
   ↓
Has model ✓, has symptoms ✓
   ↓
Execute: diagnose_repair(WDT780SAEM1, [not draining])
   ↓
Agent: "[Parts suggestions]"

Nodes hit: EXTRACT → ASK_GOAL → [wait] → EXTRACT → EXECUTE
Time: ~2s (2 LLM calls)
```

### Flow 3: Need field clarification (Longer)

```
User: "Help me install my part"
   ↓
Extract: part=null (no part number mentioned!)
         goal=install_instruction
         model=null
   ↓
Check requirements: need model AND part
   ↓
Missing: model, part
   ↓
Agent: "I need:\n- Your appliance model\n- Part number"

User: "It's WDT780SAEM1 and PS3406971"
   ↓
Extract: model=WDT780SAEM1, part=PS3406971
   ↓
Has model ✓, has part ✓
   ↓
Execute: get_installation_instructions(PS3406971, WDT780SAEM1)
   ↓
Agent: "[Video + instructions]"

Nodes hit: EXTRACT → ASK_INFO → [wait] → EXTRACT → EXECUTE
Time: ~3s (2 LLM calls)
```

---

## Performance Characteristics

```
Action              Time    LLM Calls   Cost
─────────────────────────────────────────────
EXTRACT            ~300ms     1        $$
Router decision    ~0ms       0        $
ASK_GOAL           ~100ms     0        $
ASK_INFO           ~100ms     0        $
EXECUTE_TOOL       ~500ms     0        $
─────────────────────────────────────────────

Total per turn:
- Best case: ~800ms, 1 LLM call (all fields ready)
- Avg case: ~1000ms, 1 LLM call
- Worst case: ~500ms + wait + 1000ms, 2 LLM calls

V1 for comparison: ~2-3s, 3 LLM calls always
```

---

## Debug Output Example

```
[LANGGRAPH] Graph structure initialized

============================================================
SESSION: Model: null, Part: null, Goal: null
============================================================

[EXTRACT] Parsing message...
  Extracted: { model: 'WDT780SAEM1', symptoms: ['leaking'], goal: null }
  ✓ Model → memory: WDT780SAEM1
  ✓ Symptoms → memory: leaking

[ROUTER] No goal in memory → ASK_GOAL

[ASK_GOAL] No goal detected, asking user...

Agent: "What would you like help with?..."
```

This is your debugging trail - shows exactly which node executed and why!
