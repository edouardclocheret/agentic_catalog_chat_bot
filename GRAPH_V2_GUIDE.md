# New Graph Architecture (V2) - Clear Step-by-Step Behavior

## Summary
The new graph implements explicit behavioral rules using LangGraph structure (not LLM decisions):

1. **Parse & Remember** - Extract fields from user message, add permanently to memory
2. **Check Goal** - Is a goal detected?
3. **Ask Goal** (if needed) - Ask what user wants to do
4. **Check Requirements** - Does the goal have all needed fields?
5. **Ask Info** (if needed) - Ask for missing fields
6. **Execute Tool** - Run the tool and return results

## Graph Structure

```
START
  ↓
EXTRACT ← Parse user message, add to permanent memory
  ↓
Goal in memory? ─ NO ──→ ASK_GOAL ──→ END (wait for user)
  │                        (user loops back)
  │ YES
  ↓
CHECK_REQUIREMENTS
  ↓
All fields met? ─ NO ──→ ASK_INFO ──→ END (wait for user)
  │                       (user loops back)
  │ YES
  ↓
EXECUTE_TOOL ──→ END
```

## Files

**NEW FILES:**
- `graph-v2.js` - The new graph implementation
- `agent-v2.js` - Agent runner for V2
- `test-agent-v2.js` - Basic test
- `test-all-scenarios.js` - Comprehensive test scenarios

**UNCHANGED:**
- `state.js` - State schema (still valid)
- `tools.js` - Tools (still valid)
- `memory.js` - Session memory (still valid)

## Key Differences from Previous Version

| Aspect | Old (V1) | New (V2) |
|--------|----------|---------|
| **Control Logic** | LLM decides everything | Graph structure enforces rules |
| **Goal Detection** | Optional, LLM reasons about it | Explicit extractor prompt |
| **Field Requirements** | LLM decides what's needed | `requirements` object defines per-goal |
| **Flow** | Complex routing in controllerNode | Simple conditional edges |
| **Loop-back** | Via ASK_USER → extract | Natural: ask node ends, user provides info → loop back |
| **Readability** | Complex with 3 roles | Clear step-by-step nodes |

## How It Works

### 1. EXTRACT Node
**What it does:**
- Parse user message using LLM
- Extract: model, part, symptoms, goal
- Add to permanent memory (never removes previous values)

**Example:**
```
User: "My WDT780SAEM1 is leaking"
↓
Extracted: {
  model: "WDT780SAEM1",
  part: null,
  symptoms: ["leaking"],
  goal: null  ← Not a goal statement
}
↓
Memory updated: model=WDT780SAEM1, symptoms=[leaking]
```

### 2. Check Goal Router
**Question:** Does state.goalType exist?

**If NO → go to ASK_GOAL**
- "Would you like to install a part, check compatibility, or diagnose a problem?"

**If YES → go to CHECK_REQUIREMENTS**
- Check what fields this goal needs

### 3. ASK_GOAL Node
**Shown when:** No goal detected

**Message:**
```
What would you like help with? I can:
1. Install a part
2. Check part compatibility
3. Diagnose and fix problems
4. Find parts
```

**Then:** End conversation, wait for user to reply

**Next turn:** User replies → EXTRACT detects goal → flow continues

### 4. CHECK_REQUIREMENTS Router
**For each goal, what's required?**

```javascript
{
  install_instruction: { model: ✓, part: ✓, symptoms: ✗ },
  check_compatibility: { model: ✓, part: ✓, symptoms: ✗ },
  diagnose_repair:     { model: ✓, part: ✗, symptoms: ✓ }
}
```

**If ALL requirements met → EXECUTE_TOOL**

**If ANY missing → ASK_INFO**

### 5. ASK_INFO Node
**Shown when:** Some required fields are missing

**Message:**
```
To help you with [goal], I need:
- Your appliance model number (e.g., WDT780SAEM1)
- The part number (e.g., PS3406971)
- What problems you're experiencing
```

**Then:** End conversation

**Next turn:** User provides info → EXTRACT adds to memory → flow continues

### 6. EXECUTE_TOOL Node
**Shown when:** All requirements met for the goal

**What happens:**
1. Determine which tool to call based on goal:
   - `diagnose_repair` → call `diagnose_repair(model, symptoms)`
   - `install_instruction` → call `get_installation_instructions(part, model)`
   - `check_compatibility` → call `check_compatibility(part, model)`
2. Execute tool
3. Return results to user
4. End

## Conversation Examples

### Example 1: Symptom + Model → Auto-Diagnose
```
Turn 1:
User: "My WDT780SAEM1 dishwasher is leaking"
Extract: model=WDT780SAEM1, symptoms=[leaking], goal=null
Router: No goal → ASK_GOAL
Agent: "What would you like to do?"

Turn 2:
User: "Fix it"
Extract: goal=diagnose_repair (detected!)
Router: Goal exists → CHECK_REQUIREMENTS
Check: Has model ✓, has symptoms ✓ → EXECUTE_TOOL
Execute: diagnose_repair(WDT780SAEM1, [leaking])
Agent: [Shows recommended parts]
```

### Example 2: Installation Without Model
```
Turn 1:
User: "Help me install PS3406971"
Extract: part=PS3406971, goal=install_instruction
Router: Goal exists → CHECK_REQUIREMENTS
Check: Has part ✓, missing model ✗ → ASK_INFO
Agent: "I need your appliance model number"

Turn 2:
User: "WDT780SAEM1"
Extract: model=WDT780SAEM1 (added to memory)
Router: Goal exists → CHECK_REQUIREMENTS
Check: Has part ✓, has model ✓ → EXECUTE_TOOL
Execute: get_installation_instructions(PS3406971, WDT780SAEM1)
Agent: [Shows video and steps]
```

### Example 3: Check Compatibility
```
Turn 1:
User: "Is PS3406971 compatible with WDT780SAEM1?"
Extract: part=PS3406971, model=WDT780SAEM1, goal=check_compatibility
Router: Goal exists → CHECK_REQUIREMENTS
Check: Has part ✓, has model ✓ → EXECUTE_TOOL
Execute: check_compatibility(PS3406971, WDT780SAEM1)
Agent: "✓ Part PS3406971 IS compatible with WDT780SAEM1"
```

## Why This is Better

✅ **Explicit** - Every decision is coded, not LLM-decided
✅ **Predictable** - No surprises from LLM reasoning
✅ **Debuggable** - Clear path through graph
✅ **Maintainable** - Add new goals = update `requirements` object
✅ **Efficient** - No unnecessary LLM calls for routing
✅ **Slot-filling** - Natural loop-back when fields are missing
✅ **Memory** - Fields never removed once set

## Testing

Run comprehensive tests:
```bash
node test-all-scenarios.js
```

Tests:
1. Model + symptoms → Auto-diagnose
2. Part without model → Ask model → Install
3. Symptoms only → Ask goal → Diagnose
4. Part + model → Direct compatibility check
5. Memory persistence across turns

## Memory Behavior

Once a field is set, it persists:

```
Session state after turn 1:
model=WDT780SAEM1, symptoms=[leaking], goal=diagnose_repair

Turn 2 user says: "Actually it's also noisy"
Extract: symptoms=[noisy]
Memory: symptoms=[leaking, noisy] ← ACCUMULATES

Turn 3 user says: "Can you check part PS123?"
Extract: part=PS123, goal=check_compatibility
Memory: 
- model=WDT780SAEM1  ← STILL HERE
- symptoms=[leaking, noisy]  ← STILL HERE
- part=PS123  ← NEW
- goal=check_compatibility  ← CHANGED
```

## Next Steps

1. **Replace** old graph usage with V2
2. **Update** server.js to use `agent-v2.js`
3. **Test** with real conversations
4. **Monitor** for edge cases
5. **Extend** by adding new goals to `requirements` object
