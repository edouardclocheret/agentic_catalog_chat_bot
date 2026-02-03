import express from "express";
import cors from "cors";
import crypto from "crypto";
import { runAgent } from "./agent/agent.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Session management
const sessions = {};

/**
 * POST /api/chat
 * Main endpoint for chat interactions
 * Expects: { message, sessionId }
 * Returns: { message, sessionId }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Create or retrieve session
    const id = sessionId || crypto.randomUUID();

    if (!sessions[id]) {
      console.log(`\n[SERVER] Creating NEW session: ${id}`);
      sessions[id] = {
        messages: [],
        partNumber: null,
        productModel: null,
        symptoms: [],
        goalType: null,
        emailAddress: null,
        lastToolResult: null
      };
    } else {
      console.log(`\n[SERVER] Using EXISTING session: ${id}`);
      console.log(`[SERVER]   Current goalType: ${sessions[id].goalType}`);
    }

    const sessionState = sessions[id];

    // Run the agent
    const agentResult = await runAgent(sessionState, message);

    console.log(`[SERVER] Updated session goalType: ${sessionState.goalType}`);

    res.json({
      message: agentResult.response,
      sessionId: id,
      toolData: agentResult.toolData || null
    });
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /api/sessions/:id
 * Get session details (for debugging)
 */
app.get("/api/sessions/:id", (req, res) => {
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🧠 PartSelect Chat Agent running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
});
