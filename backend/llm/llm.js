// llm.js
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompt.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askLLM(userMessages) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...userMessages.map(msg => ({ role: msg.role || "user", content: msg.content }))
  ];

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.4
  });

  return res.choices[0].message.content;
}
