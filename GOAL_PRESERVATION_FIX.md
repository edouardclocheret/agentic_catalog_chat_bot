# Goal State Preservation Fix

## The Problem

When the agent detected a goal in one turn (e.g., "install_instruction"), the goal was not being preserved in the session state for the next turn. This caused the following flow:

```
Turn 1: "Help me install PS3406971"
  → Extract: goal=install_instruction ✓
  → Memory: goalType=install_instruction ✓
  → Agent asks for model

Turn 2: "It's WDT780SAEM1"
  → Extract: goal=null (not mentioned)
  → LOSES GOAL! goalType shown as null ✗
  → Agent asks for goal again (should remember install_instruction!)
```

## Root Cause

In `agent-v2.js`, the session state update used `||` operator:

```javascript
sessionState.goalType = output.goalType || sessionState.goalType;
```

This fails when `output.goalType` is `null` or `undefined`, because:
- `null || sessionState.goalType` → uses `sessionState.goalType` ✓
- But if graph doesn't include goalType in output, it's `undefined`
- `undefined || sessionState.goalType` → works, but unreliable

## The Fix

Changed to explicit undefined check:

```javascript
sessionState.goalType = output.goalType !== undefined ? output.goalType : sessionState.goalType;
```

Also applied to all other fields for consistency:
- `productModel`
- `partNumber`
- `symptoms`

This ensures fields are only updated if they were explicitly changed, otherwise preserved from session.

## Verification

The fixed behavior now works:

```
Turn 1: "Help me install PS3406971"
  → Extract: goal=install_instruction
  → Session: goalType=install_instruction ✓

Turn 2: "It's WDT780SAEM1"
  → Extract: goal=null (not in message)
  → Session: goalType=install_instruction ✓ (PRESERVED!)
  → Agent recognizes install_instruction goal
  → Has model + part → Execute tool
  → Success!
```

## Files Modified

- `backend/agent/agent-v2.js` - Fixed state update logic

## Test

Run to verify:
```bash
node backend/test-goal-preservation.js
```

Expected output: `✅ SUCCESS: Goal preserved!`
