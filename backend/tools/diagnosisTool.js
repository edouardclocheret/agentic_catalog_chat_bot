export function diagnoseFromSymptoms(model, symptoms, partsData) {
  const parts = partsData[model]?.parts;
  if (!parts) return "Unknown model.";

  const matches = [];
  const symptomLower = symptoms.map(s => s.toLowerCase());

  for (const [partNum, partData] of Object.entries(parts)) {
    const partSymptoms = partData.solves_symptoms || partData.symptoms || [];
    
    // Check if any of the user's symptoms match this part's solves_symptoms
    const hasMatch = symptomLower.some(userSymptom =>
      partSymptoms.some(partSymptom =>
        partSymptom.toLowerCase().includes(userSymptom) || 
        userSymptom.includes(partSymptom.toLowerCase())
      )
    );

    if (hasMatch) {
      matches.push({
        partNumber: partNum,
        name: partData.name,
        price: partData.price,
        solvesSymptoms: partSymptoms
      });
    }
  }

  if (matches.length > 0) {
    const matchList = matches
      .map(m => `• **${m.partNumber}** - ${m.name} ($${m.price})`)
      .join("\n");
    return `Based on your symptoms, here are parts that could help:\n\n${matchList}`;
  }

  return "I couldn't match those symptoms to a known part. Can you be more specific?";
}
