# Project Structure Guide

## Complete File Tree

```
agentic_catalog_chat_bot/
├── LANGGRAPH_SUMMARY.md              ← Start here for overview
├── IMPLEMENTATION_CHECKLIST.md        ← Implementation status & tasks
│
├── backend/                           ← Node.js/Express backend
│   ├── QUICKSTART.md                 ← 5-minute setup guide
│   ├── LANGGRAPH_SETUP.md            ← Full configuration guide
│   ├── ARCHITECTURE.md               ← Visual diagrams & flows
│   ├── EXAMPLES.md                   ← Usage examples
│   │
│   ├── agent/                        ← LangGraph agent
│   │   ├── state.js                 ← State definition (Annotation)
│   │   ├── tools.js                 ← 6 specialized tools
│   │   ├── graph.js                 ← LangGraph workflow
│   │   ├── agent.js                 ← Agent runner interface
│   │   └── memory.js                ← (Optional) advanced memory
│   │
│   ├── tools/                        ← Legacy tool implementations
│   │   ├── compatibilityTool.js      ← Part compatibility check
│   │   ├── diagnosisTool.js          ← Problem diagnosis
│   │   └── videoTool.js              ← Video tutorials (stub)
│   │
│   ├── llm/                          ← LLM helpers
│   │   ├── llm.js                   ← OpenAI integration
│   │   └── prompt.js                ← System prompts
│   │
│   ├── data/                         ← Product database
│   │   └── parts.json               ← Parts catalog
│   │
│   ├── config.js                    ← Configuration
│   ├── server.js                    ← Express API server
│   ├── package.json                 ← Node dependencies
│   ├── .env                         ← Environment variables (local)
│   ├── .env.example                 ← Example environment
│   └── node_modules/                ← Installed packages
│
├── src/                              ← React frontend
│   ├── App.js                       ← Main component
│   ├── App.css                      ← Global styles
│   ├── index.js                     ← Entry point
│   ├── index.css                    ← Global CSS
│   │
│   ├── api/                         ← Frontend API client
│   │   └── api.js                  ← Chat API integration
│   │
│   ├── components/                  ← React components
│   │   ├── ChatWindow.js            ← Chat UI component
│   │   └── ChatWindow.css           ← Chat styles
│   │
│   ├── reportWebVitals.js          ← Performance monitoring
│   ├── setupTests.js               ← Test configuration
│   └── index.html                  ← HTML template (in public/)
│
├── public/                           ← Static assets
│   ├── index.html                  ← HTML shell
│   ├── favicon.ico                 ← Site icon
│   └── manifest.json               ← PWA manifest
│
├── package.json                      ← Frontend dependencies
├── README.md                         ← Original readme
└── .gitignore                        ← Git ignore rules
```

## File Purposes

### Documentation Files

| File | Purpose | Read When |
|------|---------|-----------|
| `LANGGRAPH_SUMMARY.md` | High-level overview | Getting started |
| `IMPLEMENTATION_CHECKLIST.md` | What's done, what's left | Planning work |
| `backend/QUICKSTART.md` | 5-minute setup | First time setup |
| `backend/LANGGRAPH_SETUP.md` | Complete configuration | Full understanding |
| `backend/ARCHITECTURE.md` | Visual diagrams | Understanding flow |
| `backend/EXAMPLES.md` | Real scenarios | Testing & examples |

### Backend - LangGraph Files

| File | Purpose | Used By |
|------|---------|---------|
| `backend/agent/state.js` | State schema | Graph nodes |
| `backend/agent/tools.js` | Tool definitions | LLM agent |
| `backend/agent/graph.js` | Workflow graph | Server |
| `backend/agent/agent.js` | Runner interface | Server |

### Backend - Server Files

| File | Purpose | Used By |
|------|---------|---------|
| `backend/server.js` | Express API | Frontend |
| `backend/config.js` | Configuration | Server |
| `backend/package.json` | Dependencies | npm |

### Backend - Support Files

| File | Purpose | Used By |
|------|---------|---------|
| `backend/llm/llm.js` | OpenAI wrapper | Agent tools |
| `backend/llm/prompt.js` | System prompts | LLM |
| `backend/tools/compatibilityTool.js` | Compatibility logic | Tools |
| `backend/tools/diagnosisTool.js` | Diagnosis logic | Tools |
| `backend/tools/videoTool.js` | Video retrieval | Tools |
| `backend/data/parts.json` | Product database | Tools |

### Frontend Files

| File | Purpose | Used By |
|------|---------|---------|
| `src/App.js` | Root component | Browser |
| `src/components/ChatWindow.js` | Chat UI | App |
| `src/api/api.js` | Backend API client | ChatWindow |
| `public/index.html` | HTML shell | Browser |

## Key Integration Points

### Frontend → Backend
```
src/api/api.js
  ↓ POST /api/chat
  ↓ {message, sessionId}
backend/server.js
  ↓ runAgent()
backend/agent/agent.js
```

### Agent Workflow
```
backend/server.js
  ↓ POST /api/chat
backend/agent/agent.js
  ↓ agentGraph.invoke()
backend/agent/graph.js
  ├─ extract node → tools → llm
  ├─ llm calls tools
  └─ tools use data/parts.json
```

### Tool Execution
```
backend/agent/tools.js (defines tools)
  ↓ Uses
backend/tools/compatibilityTool.js
backend/tools/diagnosisTool.js
  ↓ Query
backend/data/parts.json
```

## File Dependencies

```
Frontend
├── src/App.js
│   └── src/components/ChatWindow.js
│       ├── src/api/api.js
│       │   ↓ HTTP
│       └── backend/server.js
│
Backend
└── backend/server.js
    ├── backend/agent/agent.js
    │   └── backend/agent/graph.js
    │       ├── backend/agent/state.js
    │       └── backend/agent/tools.js
    │           ├── backend/tools/compatibilityTool.js
    │           ├── backend/tools/diagnosisTool.js
    │           └── backend/data/parts.json
    └── backend/config.js
```

## Environment Variables

### Frontend
`REACT_APP_API_URL` (optional)
- Where to find backend
- Default: `http://localhost:3001`

### Backend (`.env`)
```env
OPENAI_API_KEY=sk-...          # Required
PORT=3001                       # Optional, default 3001
NODE_ENV=development            # Optional
```

## Development Flow

### First Time Setup
1. Install backend deps: `cd backend && npm install`
2. Install frontend deps: `cd .. && npm install`
3. Create `.env`: `cp backend/.env.example backend/.env`
4. Add API key to `backend/.env`

### Running Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
npm start
# Runs on http://localhost:3000
```

### Testing

**Test Backend Only:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

**Test Full Integration:**
1. Open http://localhost:3000
2. Type a message in chat
3. Should see response

## Code Organization

### By Layer

**Presentation Layer** (`src/`)
- React components
- Styling
- User interactions

**API Layer** (`src/api/`, `backend/server.js`)
- HTTP endpoints
- Request/response handling
- Session management

**Agent Layer** (`backend/agent/`)
- LangGraph graph
- Tool definitions
- State management

**Data Layer** (`backend/data/`, `backend/tools/`)
- Product database
- Business logic
- Tool implementations

### By Responsibility

**User Interface**
- `src/App.js` - Container
- `src/components/ChatWindow.js` - Chat UI

**Communication**
- `src/api/api.js` - Frontend API client
- `backend/server.js` - Backend API server

**Intelligence**
- `backend/agent/agent.js` - Agent runner
- `backend/agent/graph.js` - Workflow logic
- `backend/agent/tools.js` - Tool definitions

**Data**
- `backend/data/parts.json` - Products
- `backend/tools/*.js` - Query logic

## Hot Reload / Development

### Frontend Hot Reload
- Enabled by default with `npm start`
- Changes to React files reload browser

### Backend Changes
- Stop server: `Ctrl+C`
- Make changes
- Restart: `npm start`
- Browser might need refresh if connecting

## Deployment Checklist

### Before Deploying

**Backend**
- [ ] Set `NODE_ENV=production`
- [ ] Set real `OPENAI_API_KEY`
- [ ] Add database for sessions
- [ ] Add authentication
- [ ] Add rate limiting
- [ ] Enable HTTPS/TLS

**Frontend**
- [ ] Set `REACT_APP_API_URL` to production backend
- [ ] Build: `npm run build`
- [ ] Test build locally
- [ ] Check for console errors

### Production Structure

```
Production
├── Static Files (from npm run build)
│   └── Served by CDN or web server
├── Backend (Node.js)
│   ├── Environment variables (secrets)
│   ├── Database connection
│   ├── Rate limiting
│   └── Authentication
└── Monitoring
    ├── Error tracking
    ├── Performance monitoring
    └── Analytics
```

## Quick Reference

### Add a New Tool
1. Define in `backend/agent/tools.js`
2. Add to `tools` array
3. Add to `toolMap` object
4. LLM will automatically learn to use it

### Change System Prompt
1. Edit `SYSTEM_PROMPT` in `backend/agent/graph.js`
2. Restart backend
3. Test with new behavior

### Add New Endpoint
1. Add route in `backend/server.js`
2. Implement handler function
3. Test with curl or frontend

### Debug Agent Flow
1. Check `backend/agent/graph.js` node logic
2. Add console.log in nodes
3. View session state: `GET /api/sessions/{id}`
4. Check logs in terminal

---

For next steps, read `LANGGRAPH_SUMMARY.md` or start with `backend/QUICKSTART.md`
