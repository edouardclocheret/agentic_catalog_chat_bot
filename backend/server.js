import express from "express";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import { runAgent } from "./agent/agent.js";

const app = express();
app.use(cors());
app.use(express.json());

const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));
const sessions = {};

app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  const id = sessionId || crypto.randomUUID();

  if (!sessions[id]) {
    sessions[id] = { chat: [], symptoms: [], partNumber: null, model: null };
  }

  const state = sessions[id];

  if (!message.match(/PS\d+/i)) {
    state.symptoms.push(message);
  }

  const reply = await runAgent(state, message, partsData);

  res.json({ message: reply, sessionId: id });
});

app.listen(3001, () => console.log("🧠 AI Agent running on http://localhost:3001"));
