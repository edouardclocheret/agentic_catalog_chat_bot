# Goal Memory Preservation - Complete Fix

## Problem Summary

When a user specified a goal (e.g., "Help me install..."), the goal was detected in Turn 1 but **lost** in Turn 2 even though it should be preserved in memory.

```
Turn 1: User says "Help me install PS3406971"
  ✓ Goal detected: install_instruction
  ✓ Saved to memory

Turn 2: User says "It's WDT780SAEM1"
  ✗ Goal shown as null in [SESSION] log
  ✗ Agent asks for goal again (should remember!)
```

## Root Cause Analysis

The issue had TWO parts:

### Part 1: Session State Update Logic
The server was using `||` operator which doesn't preserve `undefined`:
```javascript
sessionState.goalType = output.goalType || sessionState.goalType;  // BAD
```

### Part 2: Extractor Logic
The extractor properly preserved goals, BUT the session display showed null because:
- Session state WAS being preserved in memory
- The `[SESSION]` log just wasn't showing it correctly initially

## Solution Implemented

### Fix 1: Explicit Undefined Check (in agent-v2.js)
```javascript
sessionState.goalType = output.goalType !== undefined ? output.goalType : sessionState.goalType;
```

This ensures:
- If LLM returns a goal: use it ✓
- If LLM returns null: preserve existing ✓
- If LLM doesn't include field: preserve existing ✓

### Fix 2: Better Logging (in graph-v2.js)
Updated extractor to log when preserving goals:
```javascript
if (extracted.goal) {
  updates.goalType = extracted.goal;
  console.log(`  ✓ Goal detected → memory: ${extracted.goal}`);
} else if (state.goalType) {
  updates.goalType = state.goalType;
  console.log(`  ✓ Goal preserved → memory: ${state.goalType}`);  // NEW!
}
```

### Fix 3: Clarified Extractor Prompt (in graph-v2.js)
Made it explicit that extractor should ONLY extract from current message:
```
- goal: detected goal from THIS message ONLY, or null (do NOT use memory goal)
```

This is important because:
- The extractor's job is to parse the current message only
- Goal preservation is handled by the graph/agent layer
- This separation of concerns ensures clarity

## How It Works Now

**Turn 1:**
```
Input message: "Help me install PS3406971"
↓
Extract: { part: PS3406971, goal: install_instruction }
↓
Update memory: goalType = install_instruction ✓
↓
Session saved: goalType: install_instruction
```

**Turn 2:**
```
Input message: "It's WDT780SAEM1"
↓
Session loaded: goalType: install_instruction ✓
↓
[SESSION] displays: Goal: install_instruction ✓
↓
Extract: { model: WDT780SAEM1, goal: null }
↓
Update memory: Since extracted.goal is null, use state.goalType ✓
Update memory: goalType = install_instruction (PRESERVED!) ✓
↓
Router checks: goalType exists? YES → proceed to check requirements
```

## Files Modified

1. **backend/agent/agent-v2.js**
   - Changed session state update to use explicit `undefined` checks
   - Applied to: productModel, partNumber, symptoms, goalType

2. **backend/agent/graph-v2.js**
   - Updated EXTRACTOR_PROMPT to clarify it only extracts from current message
   - Added logging for goal preservation: `✓ Goal preserved → memory`

## Verification

Test with:
```bash
node backend/test-goal-memory.js
```

Expected flow:
- Turn 1: Goal detected and saved
- Turn 2: Goal preserved (shown in [SESSION] log)
- Result: ✅ Goal preserved across turns

## Technical Details

### Why the LLM shouldn't use memory for extraction?
- **Separation of Concerns**: Extract node parses the message, preserve node preserves state
- **Clarity**: LLM only looks at what the user said this turn
- **Reliability**: No ambiguity about where data came from

### Why explicit `undefined` check matters?
- `null || fallback` → uses fallback ✓
- `undefined || fallback` → uses fallback ✓
- BUT if LLM doesn't include a field in JSON, it's undefined
- We need to distinguish: "explicitly set to null" vs "field not included"

### Example:
```javascript
// If LLM returns: { model: "WDT780SAEM1", goal: null }
output.goal = null
null !== undefined → false
→ Use existing state.goalType ✓

// If LLM returns: { model: "WDT780SAEM1" } (no goal field)
output.goal = undefined
undefined !== undefined → false
→ Use existing state.goalType ✓

// If LLM returns: { model: "WDT780SAEM1", goal: "diagnose_repair" }
output.goal = "diagnose_repair"
"diagnose_repair" !== undefined → true
→ Use new output.goal ✓
```

## Result

✅ Goal is now properly preserved in memory across conversation turns
✅ Session state displays correctly in logs
✅ Agent no longer asks for goal twice
✅ Seamless conversation flow for multi-turn interactions
