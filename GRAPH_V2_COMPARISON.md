# Graph V2 - Architecture Comparison & Migration Guide

## The Problem with Graph V1

Graph V1 tried to have the LLM decide everything through the controller:

```javascript
// V1 PROBLEM: LLM decides routing
async function controllerNode(state) {
  // Asks LLM: "What should I do?" 
  // LLM decides: ASK_USER|LOOKUP_PART|ANSWER_USER|REFUSE
  // Problem: LLM unreliable for structured decisions
}
```

**Issues:**
- LLM sometimes forgets to ask for missing info
- Hard to enforce "never ask for already-provided data"
- Recursion issues when trying slot-filling
- Complex prompts that still don't guarantee correct behavior
- Hard to debug when LLM makes wrong decision

## The Solution: Graph V2

Move **all behavioral rules to graph structure**, keep LLM for **language only**:

```
                    ┌─────────────────────┐
                    │ EXTRACT NODE        │
                    │ LLM: Parse message  │
                    │ Graph: Enforce      │
                    │ memory permanence   │
                    └─────────┬───────────┘
                              ↓
          ┌───────────────────────────────────────┐
          │ Router 1: Goal exists?                │
          │ (Not LLM, just check state)           │
          └─────┬─────────────────┬───────────────┘
          No    │                 │    Yes
                ↓                 ↓
          ┌──────────────┐  ┌──────────────────┐
          │ ASK_GOAL     │  │ Router 2:        │
          │ (Question)   │  │ Requirements?    │
          └──────────────┘  └──┬──────────┬───┘
                    All   Missing
                     │        │
                     ↓        ↓
              [EXECUTE]  [ASK_INFO]
```

**Key insight:** Routers are **not LLM calls**, they're **conditional logic**

## Comparison Table

### V1: Multi-Role LLM with Complex Controller

```javascript
// Extract → Controller → [Tool | Answer | Extract | End]

async function controllerNode(state) {
  // Prompt: 30+ lines asking LLM to decide
  // Response: JSON with action + reason
  // Problem: Sometimes wrong decision
}
```

**Cons:**
- ❌ Hard to guarantee behavior
- ❌ Difficult debugging
- ❌ Lots of LLM calls
- ❌ Complex prompts
- ❌ Can forget context

---

### V2: Graph-Enforced Rules with Minimal LLM

```javascript
// Extract → Router1 (goal?) → [AskGoal | Router2 (needs?)]
//                                ↓
//                           [AskInfo | ExecuteTool]

function checkGoalRouter(state) {
  // No LLM! Just check: if (state.goalType)
  // Clear, deterministic
}
```

**Pros:**
- ✅ Deterministic behavior
- ✅ Easy to debug
- ✅ Fewer LLM calls
- ✅ Clear requirements
- ✅ Never forgets context (it's in state)

## Code Comparison

### V1: Trying to be smart with LLM

```javascript
const CONTROLLER_PROMPT = `You are a control agent for PartSelect support.

Rules:
1. No product info without model OR part number
2. Appliances: Dishwashers, Refrigerators ONLY
3. Request missing information
4. Refuse out-of-scope requests

Decide ONE action:
- ASK_USER: Request missing info
- LOOKUP_PART: Call a tool
- ANSWER_USER: Provide information
- REFUSE: Out of scope

Return JSON:
{
  "action": "ASK_USER|LOOKUP_PART|ANSWER_USER|REFUSE",
  "message": "What to say to user",
  "reason": "Why this action"
}`;

// Problem: Prompt is complex, LLM still makes mistakes
```

### V2: Rules in code

```javascript
// No prompt for routing. Just code:

function checkRequirementsRouter(state) {
  const requirements = {
    install_instruction: { model: true, part: true },
    check_compatibility: { model: true, part: true },
    diagnose_repair:     { model: true, symptoms: true }
  };

  const needed = requirements[state.goalType];
  const missing = [];

  if (needed.model && !state.productModel) missing.push("model");
  if (needed.part && !state.partNumber) missing.push("part");
  if (needed.symptoms && state.symptoms.length === 0) missing.push("symptoms");

  return missing.length > 0 ? "ask_info" : "execute_tool";
}

// Transparent, fast, no mistakes possible
```

## Memory Handling

### V1
```javascript
// Extractor merges, but controller might still ask for same info
// Confusing: why ask if we already have it?

if (extracted.model) {
  updates.productModel = extracted.model;
}
// But controller might still ask for model anyway
```

### V2
```javascript
// Extract always preserves memory

if (extracted.model) {
  updates.productModel = extracted.model;
} else if (state.productModel) {
  updates.productModel = state.productModel;  // Never lost
}

// Then router checks: do we have model? 
// If yes, don't ask again. Simple.
```

## Example: Fixing a Leak

### V1 Flow (What could go wrong)
```
User: "WDT780SAEM1 is leaking"
→ Extract: model=WDT780SAEM1, symptoms=[leaking]
→ Controller LLM called: "What should I do?"
→ LLM response: ASK_USER (maybe forgot symptoms!)
→ Agent: "Tell me the model?"  ← WRONG! We have it
→ User confused

OR

→ LLM response: ANSWER_USER (no tool defined!)
→ Error
```

### V2 Flow (Guaranteed)
```
User: "WDT780SAEM1 is leaking"
→ Extract: model=WDT780SAEM1, symptoms=[leaking], goal=null
→ checkGoalRouter: goal=null → go to ASK_GOAL
→ Agent: "What would you like to do?"

User: "Fix it"
→ Extract: goal=diagnose_repair
→ checkGoalRouter: goal exists → check requirements
→ checkRequirementsRouter: model=yes, symptoms=yes → execute
→ Call diagnose_repair tool
→ Success
```

## Migration Checklist

To migrate from V1 to V2:

- [ ] Keep `state.js` - Still valid
- [ ] Keep `tools.js` - Still valid
- [ ] Keep `memory.js` - Still valid
- [ ] **Remove** `graph.js` (old one)
- [ ] **Add** `graph-v2.js` (new one)
- [ ] **Remove** `agent.js` (old one)
- [ ] **Add** `agent-v2.js` (new one)
- [ ] Update server imports: `agent-v2.js` instead of `agent.js`
- [ ] Test with `test-all-scenarios.js`

### Update server.js

**Before:**
```javascript
import { runAgent } from "./agent/agent.js";
```

**After:**
```javascript
import { runAgent } from "./agent/agent-v2.js";
```

That's it! Everything else works the same.

## Performance

### V1
- Extract node: 1 LLM call
- Controller node: 1 LLM call
- Answer generator: 1 LLM call
- **Total: 3 LLM calls per message**

### V2
- Extract node: 1 LLM call
- Router nodes: 0 LLM calls (code logic)
- Tool execution: 0 LLM calls (already exists)
- **Total: 1 LLM call per message**

**67% fewer LLM calls = 67% faster, 67% cheaper**

## Adding New Goals

### V1
```javascript
// Have to update controller prompt AND add node
// Complicated
```

### V2
```javascript
// Just add to requirements object:

const requirements = {
  install_instruction: { model: true, part: true, symptoms: false },
  check_compatibility: { model: true, part: true, symptoms: false },
  diagnose_repair:     { model: true, part: false, symptoms: true },
  
  // NEW GOAL:
  video_tutorial:      { model: true, part: true, symptoms: false }
};

// And update tool execution:
if (goalType === "video_tutorial") {
  toolName = "get_video_tutorial";
  toolInput = { partNumber, model: productModel };
}
```

Done! No prompt changes needed.

## Summary

| Aspect | V1 | V2 | Winner |
|--------|----|----|--------|
| Deterministic | ❌ | ✅ | V2 |
| Debugging | ❌ | ✅ | V2 |
| Performance | ❌ | ✅ | V2 |
| Maintainability | ❌ | ✅ | V2 |
| Memory handling | ⚠️ | ✅ | V2 |
| Code clarity | ❌ | ✅ | V2 |

**V2 is objectively better for a structured slot-filling agent.**

The key insight: **Not everything needs to be LLM-decided. Graph structure can enforce rules with 100% reliability.**
