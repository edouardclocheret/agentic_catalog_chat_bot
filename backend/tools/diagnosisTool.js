export function diagnoseFromSymptoms(model, symptoms, partsData) {
  const parts = partsData[model]?.parts;
  if (!parts) return "Unknown model.";

  const matches = [];

  for (const part in parts) {
    const p = parts[part];
    if (p.symptoms?.some(s => symptoms.join(" ").toLowerCase().includes(s.toLowerCase()))) {
      matches.push(`${part} – ${p.name}`);
    }
  }

  return matches.length
    ? `Based on symptoms, these parts may be involved:\n${matches.join("\n")}`
    : "I couldn’t match those symptoms to a known part. Can you be more specific?";
}
