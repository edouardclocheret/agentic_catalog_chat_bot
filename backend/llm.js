import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function suggestPart(symptoms) {
  const prompt = `
You are a dishwasher repair expert.
Given these symptoms:
${symptoms.join("\n")}

List possible PartSelect numbers (PSxxxxxx) that could be responsible.
Return only part numbers, comma-separated.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return response.choices[0].message.content.trim();
}
