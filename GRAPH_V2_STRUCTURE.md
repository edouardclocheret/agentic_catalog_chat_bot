# Graph Structure - Clear Step-by-Step Flow

## Graph Diagram

```
                        START
                          ↓
                    ┌─────────────┐
                    │   EXTRACT   │
                    │  (parse &   │
                    │  remember)  │
                    └──────┬──────┘
                           ↓
                   ┌───────────────┐
                   │ Goal in       │
                   │ memory?       │
                   └───┬────────┬──┘
                  NO   │        │   YES
                       ↓        ↓
                    ┌──────┐  ┌──────────────┐
                    │      │  │   CHECK      │
                    │ASK   │  │REQUIREMENTS  │
                    │GOAL  │  └────┬─────┬───┘
                    │      │       │     │
                    └──┬───┘   HAS │     │MISSING
                       ↓      ALL  ↓     ↓
                      END    ┌──────────┐
                            │ ASK_INFO │
                            │ (which   │
                            │ fields?)  │
                            └────┬──────┘
                                 ↓
                                END
                                 ↑
                    ┌────────────┘
         (User provides info, loop back to EXTRACT)
         
                    EXECUTE_TOOL
                    (when all fields met)
                         ↓
                        END
```

## Step-by-Step Flow

### 1️⃣ **EXTRACT Node** (Always first)
- Parse user message
- Extract: model, part number, symptoms, goal
- **Add to permanent memory** - once set, never removed
- Continue to goal check

### 2️⃣ **Goal Check Router**
- Question: "Is goalType set in memory?"
- If NO → go to **ASK_GOAL**
- If YES → go to **CHECK_REQUIREMENTS**

### 3️⃣ **ASK_GOAL Node** (If no goal)
- Ask: "What do you want to do?"
- Options: Install part | Check compatibility | Diagnose problem | Find parts
- End conversation (wait for user to provide goal)
- **Next turn**: User says intent → EXTRACT detects it → memory saved → flow continues

### 4️⃣ **CHECK_REQUIREMENTS Node** (Router - no user output)
- Query: "What does this goal need?"
  - `install_instruction` needs: model ✓ + part ✓
  - `check_compatibility` needs: model ✓ + part ✓
  - `diagnose_repair` needs: model ✓ + symptoms ✓
- If any missing → go to **ASK_INFO**
- If all present → go to **EXECUTE_TOOL**

### 5️⃣ **ASK_INFO Node** (If fields missing)
- Identify which fields are missing
- Ask user for them: "I need your appliance model..."
- End conversation
- **Next turn**: User provides info → EXTRACT adds to memory → flow continues

### 6️⃣ **EXECUTE_TOOL Node** (When ready)
- Call the tool for the goal:
  - `diagnose_repair` with model + symptoms
  - `install_instruction` with part + model
  - `check_compatibility` with part + model
- Return results to user
- End conversation

## Key Features

✅ **Clear explicit graph structure** - Each node is a decision point or action
✅ **Permanent memory** - Once model/part/symptoms/goal set, never lost
✅ **Slot-filling loop** - If info missing, ask → user replies → parse → loop back
✅ **Goal-driven behavior** - Once goal detected, only ask for fields needed for that goal
✅ **No speculation** - Nodes route based on state, not LLM decisions
✅ **Readable** - Router functions make logic explicit

## Tool Requirements Mapping

```javascript
const requirements = {
  install_instruction: { model: true, part: true, symptoms: false },
  check_compatibility: { model: true, part: true, symptoms: false },
  diagnose_repair: { model: true, part: false, symptoms: true }
};
```

## Example Conversation Flow

```
Turn 1:
User: "My dishwasher WDT780SAEM1 is leaking"
→ EXTRACT: model=WDT780SAEM1, symptoms=[leaking], goal=null
→ No goal → ASK_GOAL: "What would you like to do?"

Turn 2:
User: "I want to fix it"
→ EXTRACT: goal=diagnose_repair (detected from context)
→ Goal exists → CHECK_REQUIREMENTS
→ Has model ✓, has symptoms ✓ → EXECUTE_TOOL
→ Call diagnose_repair(WDT780SAEM1, [leaking])
→ Return parts suggestions
```

```
Turn 1:
User: "Help me install PS3406971"
→ EXTRACT: part=PS3406971, goal=install_instruction
→ Goal exists → CHECK_REQUIREMENTS
→ Has part ✓, missing model ✗ → ASK_INFO
→ "I need your appliance model number"

Turn 2:
User: "It's a WDT780SAEM1"
→ EXTRACT: model=WDT780SAEM1 (added to memory)
→ Goal exists → CHECK_REQUIREMENTS
→ Has part ✓, has model ✓ → EXECUTE_TOOL
→ Call get_installation_instructions(PS3406971, WDT780SAEM1)
→ Return video and steps
```
