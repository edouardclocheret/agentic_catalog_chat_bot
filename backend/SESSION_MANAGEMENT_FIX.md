# Session Management - CRITICAL

## The Problem

Your logs show:
```
[SERVER] Creating NEW session: 0768d570-ecda-4560-8cdf-2eabb4a83354
...
[SERVER] Creating NEW session: 58e0ca1f-2eea-4340-8bf2-413a689c18b8
```

**Two different session IDs = Two separate sessions = Memory loss between turns**

## Root Cause

Your frontend/test client is making API calls **WITHOUT sending back the sessionId**:

```
Turn 1: POST /api/chat { "message": "I need installation instructions" }
        Response: { "message": "...", "sessionId": "0768d570..." }
        ❌ Client ignores sessionId

Turn 2: POST /api/chat { "message": "for the appliance WDT780SAEM1" }
        ❌ NO sessionId sent
        Server: "I don't see a sessionId, creating NEW session!"
        New Session: "58e0ca1f..." with null memory
```

## The Solution

**Always include sessionId in subsequent requests:**

```javascript
// Turn 1
const response1 = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: "I need installation instructions"
    // No sessionId (first request)
  })
});
const data1 = await response1.json();
const sessionId = data1.sessionId; // ← Save this!

// Turn 2
const response2 = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: "for the appliance WDT780SAEM1",
    sessionId: sessionId  // ← Send it back!
  })
});
```

## How Sessions Work

### Without sessionId (❌ Creates NEW session):
```
Request: { message: "..." }
         ↓
Server checks: if (!sessions[undefined]) → TRUE
         ↓
Creates NEW session with null memory
         ↓
Result: Memory lost
```

### With sessionId (✅ Reuses existing session):
```
Request: { message: "...", sessionId: "abc123" }
         ↓
Server checks: if (!sessions["abc123"]) → FALSE
         ↓
Reuses existing session with preserved memory
         ↓
Result: Memory maintained
```

## Server Code Logic

```javascript
// server.js
app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  
  // Create or retrieve session
  const id = sessionId || crypto.randomUUID();  // ← If no ID, create new one
  
  if (!sessions[id]) {
    // Only create if doesn't exist
    sessions[id] = { productModel: null, partNumber: null, ... };
  }
  
  const sessionState = sessions[id];
  const reply = await runAgent(sessionState, message);
  
  res.json({
    message: reply,
    sessionId: id  // ← Return it so client can send it back
  });
});
```

## The Issue in Your Chat

```
Turn 1: User: "I need installation instructions"
        Agent: Sets goal = "install_instruction" ✓
        Returns: sessionId = "0768d570..."
        
Turn 2: User: "for the appliance WDT780SAEM1"
        ❌ You sent NO sessionId
        ❌ Server created NEW session "58e0ca1f..."
        ❌ New session has goal = null
        Agent: Doesn't remember goal from Turn 1 ✗
```

## What SHOULD Happen

```
Turn 1: User: "I need installation instructions"
        Agent: Sets goal = "install_instruction" ✓
        Returns: sessionId = "0768d570..."
        
Turn 2: User: "for the appliance WDT780SAEM1"
        ✅ You send sessionId = "0768d570..."
        ✅ Server reuses same session
        ✅ Session remembers goal = "install_instruction"
        Agent: Extracts model, checks requirements with remembered goal ✓
```

## Checklist for Your Client/Frontend

- [ ] Store `sessionId` from first API response
- [ ] Include `sessionId` in every subsequent request in same conversation
- [ ] Don't create new requests without sessionId (unless starting fresh conversation)
- [ ] Session IDs persist on server - same ID = same memory

## Testing

Run this test to verify session management works when sessionId is sent:

```bash
node backend/test-api-session.js
```

This test properly sends the sessionId between requests and should show memory being preserved.

## Conclusion

**The graph is NOT overwriting memory. The problem is that each turn is creating a NEW session instead of reusing the existing one.**

✅ **Fix the frontend to send sessionId back**
✅ **Then memory will persist correctly**
