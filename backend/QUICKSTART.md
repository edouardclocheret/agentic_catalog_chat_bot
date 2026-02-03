# LangGraph Agent - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
cd backend
npm install
```

This installs:
- LangGraph and LangChain libraries
- OpenAI SDK for GPT-4o-mini integration
- Express and CORS for API server

### 2. Set Up Environment

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-your-api-key-here
PORT=3001
```

Get your API key from [OpenAI Dashboard](https://platform.openai.com/api-keys)

### 3. Start the Backend Server

```bash
npm start
```

You should see:
```
🧠 PartSelect Chat Agent running on http://localhost:3001
📝 Health check: http://localhost:3001/health
```

### 4. (Optional) Test with curl

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How can I fix the ice maker on my WDT780SAEM1?"
  }'
```

Expected response:
```json
{
  "message": "Based on your symptoms, the Ice Maker Assembly (PS11752778) is likely the issue...",
  "sessionId": "uuid-here"
}
```

### 5. Start the Frontend

In a new terminal:

```bash
cd ..  # Back to root
npm start
```

The React app will open at `http://localhost:3000`

## 📁 Project Structure

```
backend/
├── agent/
│   ├── state.js          ← State definitions
│   ├── tools.js          ← LangGraph tools
│   ├── graph.js          ← Workflow graph
│   └── agent.js          ← Agent runner
├── server.js             ← Express API
├── data/
│   └── parts.json        ← Product database
└── package.json          ← Dependencies
```

## 🛠️ How It Works

1. **User sends message** → Frontend API call
2. **Server receives message** → Routes to agent
3. **Agent extracts info** → Finds part numbers, models, symptoms
4. **LLM decides** → Should I use tools or respond directly?
5. **Tools execute** → Query database for parts
6. **LLM responds** → Generates helpful answer based on tool results
7. **Response sent** → Back to frontend and displays in chat

## 🎯 Example Queries to Try

### Find Parts for a Model
"What parts are available for WDT780SAEM1?"

### Check Compatibility
"Is PS11752778 compatible with WDT780SAEM1?"

### Troubleshoot a Problem
"The ice maker on my fridge is not working. I have model WDT780SAEM1."

### Get Installation Help
"How do I install PS11752778?"

## 🔧 Troubleshooting

### "Cannot find module @langchain/core"
```bash
npm install @langchain/core @langchain/langgraph @langchain/openai
```

### "OPENAI_API_KEY not found"
- Create `backend/.env` file
- Add `OPENAI_API_KEY=sk-...`
- Restart server

### Slow responses
- First request might be slow (LLM startup)
- Typical response: 1-3 seconds
- Check your API key is valid

### Frontend can't connect to backend
- Ensure backend is running on port 3001
- Check `REACT_APP_API_URL` environment variable
- Verify CORS is enabled

## 📊 Key Files Explained

### `agent/state.js`
Defines what information the agent tracks:
- Conversation messages
- Extracted part numbers and models
- Symptoms and tool results
- Final response

### `agent/tools.js`
Six tools the LLM can use:
1. `search_parts` - Find parts by keyword/symptom
2. `check_compatibility` - Verify part compatibility
3. `diagnose_repair` - Suggest parts for problems
4. `get_installation_instructions` - Installation steps
5. `get_part_details` - Full product information
6. `extract_information` - Extract numbers from text

### `agent/graph.js`
The workflow:
1. Extract user message
2. LLM decides what to do
3. Execute tools if needed
4. LLM generates response
5. Return to user

### `server.js`
Three endpoints:
- `POST /api/chat` - Main chat endpoint
- `GET /health` - Server health check
- `GET /api/sessions/:id` - Debug session state

## 💡 Next Steps

1. **Try different prompts** - See how agent responds
2. **Add more tools** - Extend `agent/tools.js`
3. **Customize behavior** - Edit SYSTEM_PROMPT in `agent/graph.js`
4. **Monitor performance** - Check response times and tokens
5. **Deploy** - Set up on your server

## 📚 Learn More

- Full documentation: `LANGGRAPH_SETUP.md`
- Architecture details: `ARCHITECTURE.md`
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LangChain Docs](https://js.langchain.com/)

## ❓ FAQ

**Q: Why LangGraph instead of direct API calls?**
A: LangGraph handles complex multi-step workflows, state management, and tool selection automatically. It's more reliable and scalable.

**Q: Can I use a different LLM?**
A: Yes! Change `ChatOpenAI` to other LangChain models like Claude, Gemini, Llama, etc.

**Q: How do I add new tools?**
A: Create a new tool in `agent/tools.js` and add to the `tools` array. LLM automatically learns to use it!

**Q: Is session state persistent?**
A: Currently in-memory. For production, add a database (MongoDB, PostgreSQL) to persist sessions.

**Q: How much does this cost?**
A: Depends on usage. GPT-4o-mini is ~0.00015 per 1K tokens. A typical query uses ~500 tokens, so ~$0.000075 per query.

Happy building! 🚀
