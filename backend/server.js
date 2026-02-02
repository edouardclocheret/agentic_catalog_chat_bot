import express from "express";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import { suggestPart } from "./llm.js";
import { getRepairVideo } from "./tools.js";

const app = express();
app.use(cors());
app.use(express.json());

const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));
const sessions = {};   // agent memory

app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  const id = sessionId || crypto.randomUUID();

  if (!sessions[id]) {
    sessions[id] = {
      symptoms: [],
      partNumber: null,
      goalComplete: false
    };
  }

  const state = sessions[id];

  // Did user provide a part number?
  const match = message.match(/PS\d+/i);
  if (match) {
    state.partNumber = match[0].toUpperCase();
  } else {
    state.symptoms.push(message);
  }

  // If we have the part number → use tool
  if (state.partNumber) {
    const video = getRepairVideo(state.partNumber, partsData);

    const reply = video
      ? `✅ I found the repair video for **${state.partNumber}**:\n${video}`
      : `I found the part number ${state.partNumber}, but no video exists in the database.`;

    return res.json({ message: reply, sessionId: id });
  }

  // Otherwise → ask GPT to suggest likely parts
  const candidates = await suggestPart(state.symptoms);

  const reply = `
Based on your symptoms, these parts may be involved:
${candidates}

Please provide the **PartSelect number (PS...)** of the part you want.
`;

  res.json({ message: reply, sessionId: id });
});

app.listen(3001, () => {
  console.log("AI Agent running on http://localhost:3001");
});
