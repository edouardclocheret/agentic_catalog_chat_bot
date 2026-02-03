# LangGraph Agent - Usage Examples

## 1. Chat API Endpoint

### Basic Query

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What parts do you have for WDT780SAEM1?"}'
```

**Response:**
```json
{
  "message": "For model WDT780SAEM1, we have several parts available including...",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Multi-turn Conversation

**First request:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "My ice maker is not working"
  }'
```

**Response:**
```json
{
  "message": "I'd like to help fix your ice maker. What's the model number of your refrigerator?",
  "sessionId": "uuid-1"
}
```

**Second request (with sessionId):**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "It's a WDT780SAEM1",
    "sessionId": "uuid-1"
  }'
```

**Response:**
```json
{
  "message": "Based on your model WDT780SAEM1 with ice maker issues, I recommend the Ice Maker Assembly (PS11752778) - $189.99. This part is in stock and comes with a 1-year warranty.",
  "sessionId": "uuid-1"
}
```

The agent remembers the previous message and context!

## 2. User Scenarios

### Scenario 1: Troubleshooting

**User:** "The dishwasher isn't cleaning dishes well anymore, model WDTK1088AZ"

**Agent Flow:**
1. Extracts model: `WDTK1088AZ`
2. Identifies symptom: `not cleaning`
3. Calls `diagnose_repair` tool
4. Finds `Spray Arm (PS22567890)` as likely cause
5. Provides diagnosis with part recommendation

**Response:**
```
Based on your symptoms, the issue is likely with the Spray Arm (PS22567890). 
When dishes aren't getting clean, it's usually because water isn't spraying properly. 

Here are your options:
1. **Spray Arm (PS22567890)** - $45.99 - Easy 10-minute installation
2. **Wash Pump Motor (PS20345678)** - $199.99 - If the spray arm doesn't fix it

Would you like installation instructions for either part?
```

### Scenario 2: Compatibility Check

**User:** "Can I use PS11752778 on my model WDT750SAHZ0?"

**Agent Flow:**
1. Extracts part number: `PS11752778`
2. Extracts model: `WDT750SAHZ0`
3. Calls `check_compatibility` tool
4. Returns compatibility result

**Response:**
```
✓ Yes, PS11752778 (Ice Maker Assembly) is compatible with your WDT750SAHZ0 model.

This part is:
- Price: $189.99
- Warranty: 1 year
- Installation difficulty: Moderate (30-45 minutes)
- In stock: Yes

Would you like installation instructions?
```

### Scenario 3: Installation Help

**User:** "How do I install PS11752778?"

**Agent Flow:**
1. Remembers previous context (part number from conversation)
2. Or extracts from new message
3. Asks for model if not provided
4. Calls `get_installation_instructions` tool

**Response:**
```
**Installation Instructions for PS11752778 (Ice Maker Assembly)**

Tools needed:
- Phillips head screwdriver
- Adjustable wrench

Steps:
1. **Prepare** - Unplug the refrigerator
2. **Remove** - Open the freezer door and remove the old ice maker
3. **Install** - Align the new ice maker with mounting brackets
4. **Secure** - Screw in the fasteners
5. **Connect** - Connect the water line and electrical connector
6. **Test** - Plug in and run an ice cycle

Estimated time: 30-45 minutes
Difficulty: Moderate

Having trouble? You can request a video tutorial for this part.
```

### Scenario 4: Product Search

**User:** "Do you have any replacement water valves?"

**Agent Flow:**
1. Calls `search_parts` tool with query: `water valve`
2. Asks for model if needed
3. Returns matching parts

**Response:**
```
Found 2 water valve products:

1. **Water Inlet Valve (PS12345601)**
   - Price: $124.99
   - Model compatibility: WDT780SAEM1, WDT750SAHZ0, and others
   - Use case: Water not dispensing, ice maker not getting water
   - Installation: 20-30 minutes

2. **Another Valve Option (PS54321098)**
   - Price: $89.99
   - Different compatibility

Which model are you working with? I can check compatibility for you.
```

## 3. State Management Examples

### Session Tracking

The agent maintains state across turns:

```javascript
// Session state after first message
{
  messages: [
    {role: "user", content: "My ice maker isn't working"},
    {role: "assistant", content: "What model is your appliance?"}
  ],
  userMessage: "My ice maker isn't working",
  symptoms: ["ice maker not working"],
  partNumber: null,
  productModel: null
}

// After second message
{
  messages: [
    {role: "user", content: "My ice maker isn't working"},
    {role: "assistant", content: "What model is your appliance?"},
    {role: "user", content: "WDT780SAEM1"},
    {role: "assistant", content: "Great! Let me find the right part..."},
    {role: "tool", content: "Found Ice Maker Assembly (PS11752778)..."},
    {role: "assistant", content: "Based on your model..."}
  ],
  userMessage: "WDT780SAEM1",
  symptoms: ["ice maker not working"],
  partNumber: "PS11752778",
  productModel: "WDT780SAEM1"
}
```

## 4. Tool Invocation Examples

### Direct Tool Calls (internally)

The LLM automatically decides to call tools. Here's what happens internally:

**search_parts tool:**
```json
{
  "name": "search_parts",
  "args": {
    "query": "ice maker",
    "model": "WDT780SAEM1"
  }
}
```

**check_compatibility tool:**
```json
{
  "name": "check_compatibility",
  "args": {
    "partNumber": "PS11752778",
    "model": "WDT780SAEM1"
  }
}
```

**diagnose_repair tool:**
```json
{
  "name": "diagnose_repair",
  "args": {
    "model": "WDT780SAEM1",
    "symptoms": ["ice maker not working", "water not dispensing"]
  }
}
```

## 5. Error Handling Examples

### Unknown Model
**User:** "What parts do you have for MODEL-XYZ?"

**Response:**
```
I'm not familiar with model MODEL-XYZ. 

I specialize in Refrigerator and Dishwasher parts. 
Could you please verify the model number? 

Common formats include:
- WDT780SAEM1
- WDTK1088AZ
- Similar Whirlpool models

What model are you working with?
```

### Out of Scope
**User:** "Can you help me with my washing machine?"

**Response:**
```
I specialize in Refrigerator and Dishwasher parts for PartSelect. 

Unfortunately, I can't help with washing machine parts. You might want to:
- Visit our main site for washing machine support
- Contact our customer service team
- Browse our dishwasher or refrigerator sections

Is there anything I can help with for refrigerators or dishwashers?
```

## 6. Frontend Integration

### React Component Usage

```javascript
// src/components/ChatWindow.js
const [sessionId, setSessionId] = useState(null);

const handleSend = async (message) => {
  const response = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      sessionId: sessionId  // Maintain session
    })
  });

  const data = await response.json();
  
  // Update messages
  setMessages(prev => [...prev, {role: "user", content: message}]);
  setMessages(prev => [...prev, {role: "assistant", content: data.message}]);
  
  // Update session
  setSessionId(data.sessionId);
};
```

## 7. Performance Metrics

### Response Time Breakdown

```
Total: ~2.5 seconds

├── Network (Request) ...................... 50ms
├── Server Processing ..................... 200ms
├── LLM Inference (GPT-4o-mini) .......... 1500ms
│   ├── Tool selection ................... 800ms
│   └── Tool execution ................... 300ms
│   └── Final response generation ........ 400ms
├── Server Response ........................ 150ms
└── Network (Response) ..................... 100ms
```

### Token Usage Example

A typical user query:

```
Input tokens:  ~450
- System prompt: ~200
- Conversation history: ~150
- Current message: ~100

Output tokens: ~200
- Tool selection: ~50
- Tool results: ~80
- Final response: ~70

Total: ~650 tokens
Cost: ~$0.00010 (at GPT-4o-mini rates)
```

## 8. Testing Tools

### Health Check
```bash
curl http://localhost:3001/health
```

Response:
```json
{"status":"ok","timestamp":"2024-02-02T..."}
```

### Get Session State
```bash
curl http://localhost:3001/api/sessions/uuid-1
```

Response:
```json
{
  "messages": [...],
  "partNumber": "PS11752778",
  "productModel": "WDT780SAEM1",
  "symptoms": ["ice maker not working"]
}
```

## 9. Advanced Scenarios

### Multi-step Repair Process

**Turn 1:** User describes problem
→ Agent asks for model

**Turn 2:** User provides model
→ Agent diagnoses with tools

**Turn 3:** User asks for installation help
→ Agent provides instructions

**Turn 4:** User confirms repair success
→ Agent offers related products

This flows naturally with maintained context!

### Complex Compatibility Matrix

**Scenario:** User wants a part for multiple models

**User:** "Do you have a part that works with both WDT780SAEM1 and WDT750SAHZ0?"

**Agent Flow:**
1. For each search result, calls `check_compatibility` twice
2. Returns only parts compatible with both
3. Recommends best option

---

These examples show how LangGraph handles various scenarios automatically through intelligent tool selection and state management!
