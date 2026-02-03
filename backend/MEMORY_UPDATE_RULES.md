# Memory Update Rules

## Overview

Your system uses a **write-once memory model** where values can be updated, but only under specific conditions. Once a value is set, it persists permanently unless explicitly replaced with a new non-null value.

---

## Update Rules by Field

### 1. **Model (productModel)**

#### How it gets SET initially:
```
User says: "My appliance is WDT780SAEM1"
           ↓
      [EXTRACT NODE]
           ↓
      LLM extracts: model = "WDT780SAEM1"
           ↓
      Memory updated: productModel = "WDT780SAEM1" ✓
```

#### How it STAYS in memory:
```
Subsequent turns where user doesn't mention model:
           ↓
      LLM sees in prompt: "model: ALWAYS return null (already locked in memory)"
           ↓
      LLM returns: model = null
           ↓
      Logic: extracted.model === null → PRESERVE existing memory
           ↓
      Memory UNCHANGED: productModel = "WDT780SAEM1" ✓
```

#### How it can be UPDATED:
```
User says: "Actually, my model is different: WDT990SAEM1"
           ↓
      [EXTRACT NODE]
           ↓
      LLM extracts: model = "WDT990SAEM1" (new value)
           ↓
      Logic: extracted.model !== null → UPDATE memory
           ↓
      Memory UPDATED: productModel = "WDT990SAEM1" ✓
```

#### When it CANNOT be updated:
```
User says: "I don't have a model"
           ↓
      LLM extracts: model = null
           ↓
      Logic: extracted.model === null → PRESERVE (do not erase)
           ↓
      Memory UNCHANGED: productModel = "WDT780SAEM1" (not erased)
      
❌ Cannot be set to null by returning null from LLM
❌ Cannot be erased or forgotten
✓ Can ONLY be updated by providing a new non-null model
```

---

### 2. **Part Number (partNumber)**

**Same rules as Model:**

#### SET:
```javascript
User provides part number → LLM extracts non-null value → Memory updated
```

#### PRESERVE:
```javascript
User doesn't mention part → LLM returns null → Memory PRESERVED
```

#### UPDATE:
```javascript
User provides NEW part number → LLM extracts new non-null value → Memory UPDATED
```

#### CANNOT:
```javascript
❌ LLM returning null erases the part
❌ Partial information resets it
✓ ONLY new non-null values update it
```

---

### 3. **Goal (goalType)**

**Same rules as Model and Part:**

#### SET:
```javascript
User says: "I want to install a part"
LLM extracts: goal = "install_instruction"
Memory updated: goalType = "install_instruction" ✓
```

#### PRESERVE:
```javascript
User talks about symptoms (doesn't restate goal)
LLM sees: "goal: ALWAYS return null (already locked as install_instruction)"
LLM returns: goal = null
Memory PRESERVED: goalType = "install_instruction" ✓
```

#### UPDATE:
```javascript
User says: "Actually, I want to diagnose a problem"
LLM extracts: goal = "diagnose_repair"
Memory UPDATED: goalType = "diagnose_repair" ✓
```

#### CANNOT:
```javascript
❌ Never erased by null return
❌ Never reset to null
✓ ONLY updated by user explicitly stating new goal
```

---

### 4. **Symptoms (symptoms)**

**Different rules - accumulating field:**

#### SET (first mention):
```javascript
User says: "My dishwasher is leaking"
LLM extracts: symptoms = ["leaking"]
Memory SET: symptoms = ["leaking"] ✓
```

#### ACCUMULATE (add more):
```javascript
User says: "And it's also making noise"
LLM extracts: symptoms = ["noisy"]
Logic: Merge with existing → symptoms = ["leaking", "noisy"] ✓
Memory ACCUMULATED: symptoms = ["leaking", "noisy"]
```

#### PRESERVE (no new symptoms):
```javascript
User says: "Can you help me?"
LLM extracts: symptoms = []
Memory PRESERVED: symptoms = ["leaking", "noisy"] ✓
```

#### DEDUPLICATE (same symptom mentioned twice):
```javascript
User says: "It's leaking again"
LLM extracts: symptoms = ["leaking"]
Logic: Deduplicate with Set → symptoms = ["leaking", "noisy"]
Memory UNCHANGED: symptoms = ["leaking", "noisy"] (no duplicate)
```

#### CANNOT:
```javascript
❌ Symptoms NEVER get erased
❌ Symptoms NEVER get replaced (only accumulated)
✓ New symptoms are ADDED to existing symptoms
✓ Duplicates are automatically removed
```

---

## Code Implementation

### Extract Node Logic

```javascript
// Model - Update ONLY if LLM extracted non-null value
if (extracted.model !== null && extracted.model !== undefined) {
  updates.productModel = extracted.model.toUpperCase();
  console.log(`  ✓ Model updated → memory: ${extracted.model}`);
} else if (state.productModel) {
  // Preserve existing if LLM returned null
  updates.productModel = state.productModel;
  console.log(`  🔒 Model preserved: ${state.productModel}`);
}

// Same pattern for: part, goal
// Different pattern for: symptoms (accumulates instead)
```

### Agent Level Logic

```javascript
// In agent-v2.js after graph execution:
sessionState.goalType = output.goalType !== undefined 
  ? output.goalType 
  : sessionState.goalType;  // Preserve if undefined
```

This ensures even if a node doesn't return a field, session memory keeps it.

---

## Update Scenarios

### Scenario 1: User Provides New Information Over Time

```
Turn 1: "I have a WDT780SAEM1"
  Memory: { model: "WDT780SAEM1" }

Turn 2: "I want to install a part"
  LLM: Returns null for model (locked)
  Memory: { model: "WDT780SAEM1", goal: "install_instruction" }

Turn 3: "The part is PS3406971"
  LLM: Returns null for model and goal (locked)
  Memory: { model: "WDT780SAEM1", goal: "install_instruction", part: "PS3406971" }

Turn 4: "And it's leaking"
  LLM: Returns null for model, goal, part; returns ["leaking"] for symptoms
  Memory: { model: "WDT780SAEM1", goal: "install_instruction", part: "PS3406971", symptoms: ["leaking"] }
```

**Result:** All fields preserved, symptoms accumulated ✓

---

### Scenario 2: User Changes Their Mind

```
Initial: User wants to INSTALL
  Memory: { goal: "install_instruction" }

Later: User says: "Actually, I want to DIAGNOSE a problem"
  LLM extracts: goal = "diagnose_repair" (new non-null value)
  Memory: { goal: "diagnose_repair" } ✓ Updated

Even later: User just talks without mentioning goal
  LLM returns: goal = null (locked)
  Memory: { goal: "diagnose_repair" } ✓ Preserved
```

**Result:** Goal only changes when user explicitly states new goal ✓

---

### Scenario 3: User Provides Incomplete Information

```
Turn 1: "My model is WDT780SAEM1"
  Memory: { model: "WDT780SAEM1" }

Turn 2: "I'm not sure about my model anymore"
  LLM extracts: model = null (user expressed uncertainty)
  Logic: extracted.model === null → PRESERVE (don't erase!)
  Memory: { model: "WDT780SAEM1" } ✓ Unchanged

Turn 3: "Actually, it's definitely WDT990SAEM1"
  LLM extracts: model = "WDT990SAEM1"
  Logic: extracted.model !== null → UPDATE
  Memory: { model: "WDT990SAEM1" } ✓ Updated
```

**Result:** Uncertainty doesn't erase memory; new certainty updates it ✓

---

## Update Trigger Points

### When Memory CAN Be Updated

1. **User explicitly provides new information**
   ```
   "My model is actually XYZ" → Model updates
   "I changed my mind, diagnose instead" → Goal updates
   ```

2. **LLM successfully extracts non-null value**
   ```
   extracted.field !== null && extracted.field !== undefined → Update
   ```

3. **Only through EXTRACT node**
   - Other nodes preserve but don't update memory fields
   - Extraction is the ONLY entry point for memory updates

### When Memory CANNOT Be Updated

1. **LLM returns null**
   ```
   extracted.field === null → SKIP update, preserve existing
   ```

2. **User expresses uncertainty**
   ```
   "I don't know my model" → LLM returns null → Memory preserved
   ```

3. **User doesn't mention a field**
   ```
   User talks about something else → LLM returns null for that field → Memory preserved
   ```

4. **Trying to explicitly erase**
   ```
   "Forget my model" → LLM returns null → Memory still preserved
   ```

---

## Memory Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ INITIAL STATE                                       │
│ { model: null, part: null, goal: null }             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ USER PROVIDES VALUE (e.g., "My model is WDT...")   │
│ LLM extracts: model = "WDT..."                      │
│ → UPDATE to "WDT..."                                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ VALUE LOCKED IN MEMORY                              │
│ { model: "WDT..." }                                 │
│ ✓ Will be used for all future decisions             │
│ ✓ Will persist across all turns                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ LOOP: Each Turn                                     │
│                                                     │
│ 1. User provides new message                        │
│ 2. LLM extracts (model = null because locked)       │
│ 3. If extracted.model === null → PRESERVE "WDT..."  │
│ 4. Memory unchanged                                 │
│                                                     │
│ REPEAT until user explicitly provides new model    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ USER PROVIDES NEW VALUE (e.g., "Actually model XYZ"│
│ LLM extracts: model = "XYZ"                         │
│ → UPDATE to "XYZ"                                   │
│ ✓ New value now locked in memory                    │
└─────────────────────────────────────────────────────┘
```

---

## Summary: Memory Update Rules

| Condition | What Happens | Memory State |
|-----------|-------------|--------------|
| **LLM returns non-null value** | ✓ Memory UPDATED with new value | Updated field |
| **LLM returns null** | ✓ Memory PRESERVED (no change) | Unchanged |
| **Field not mentioned by user** | ✓ Memory PRESERVED (no change) | Unchanged |
| **User expresses uncertainty** | ✓ Memory PRESERVED (no change) | Unchanged |
| **User provides new info** | ✓ Memory UPDATED with new value | Updated field |
| **User tries to erase** | ✓ Memory PRESERVED (no change) | Unchanged |
| **Node returns undefined** | ✓ Memory PRESERVED (agent level) | Unchanged |

**Key Principle:** Memory is **write-once, forward-only**. Values can only change if the LLM extracts a new non-null value.
