import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";

// Load parts data
const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));

/**
 * COMPATIBILITY TOOL LOGIC
 * Check if a part is compatible with an appliance model
 */
function isPartCompatible(partNumber, model, partsData) {
  // Check if model exists in data
  if (!partsData[model]) {
    return false;
  }

  // Check if part exists in this model's parts
  const modelParts = partsData[model].parts || {};
  return partNumber in modelParts;
}

/**
 * DIAGNOSIS TOOL LOGIC
 * Diagnose repair needs from symptoms
 */
function diagnoseFromSymptoms(model, symptoms, partsData) {
  console.log(`\n[DIAGNOSIS] Called with model: ${model}, symptoms: ${JSON.stringify(symptoms)}`);
  
  if (!partsData[model]) {
    console.log(`[DIAGNOSIS] Model not found: ${model}`);
    return `Model ${model} not found in database`;
  }

  const modelParts = partsData[model].parts || {};
  const suggestedParts = [];

  console.log(`[DIAGNOSIS] Searching ${Object.keys(modelParts).length} parts for matches...`);

  // Normalize function: replace curly quotes and other variants with standard apostrophe
  const normalizeString = (str) => {
    return str
      .replace(/['']/g, "'")  // Replace curly quotes with regular apostrophe
      .toLowerCase()
      .trim();
  };

  // Normalize user symptoms once
  const normalizedUserSymptoms = symptoms.map(normalizeString);

  // Search through all parts for this model and find matches
  for (const [partNum, partData] of Object.entries(modelParts)) {
    // Use solves_symptoms field from the parts data
    const partSymptoms = (partData.solves_symptoms || []);
    
    // Check if any user symptom matches any of this part's solves_symptoms
    const hasMatch = normalizedUserSymptoms.some(normalizedUserSymptom =>
      partSymptoms.some(partSymptom => {
        const normalizedPartSymptom = normalizeString(partSymptom);
        return normalizedPartSymptom === normalizedUserSymptom;
      })
    );

    if (hasMatch) {
      console.log(`[DIAGNOSIS]   ✓ Part ${partNum} matches`);
      suggestedParts.push({
        partNumber: partNum,
        name: partData.name,
        price: partData.price,
        description: partData.description,
        image_url: partData.image_url,
        solves_symptoms: partData.solves_symptoms || []
      });
    }
  }

  console.log(`[DIAGNOSIS] Found ${suggestedParts.length} matching parts`);

  // Keep only top 3 matches
  const topParts = suggestedParts.slice(0, 3);

  if (topParts.length === 0) {
    return `No parts found for symptoms: ${symptoms.join(", ")}. Please describe the issue in more detail.`;
  }

  return JSON.stringify(
    {
      model,
      symptoms,
      suggestedParts: topParts,
      message: `Found ${topParts.length} part(s) that might fix these issues`
    },
    null,
    2
  );
}

/**
 * Tool: Check part compatibility
 */
export const checkCompatibilityTool = tool(
  async ({ partNumber, model }) => {
    const compatible = isPartCompatible(partNumber, model, partsData);
    return compatible
      ? `✓ Part ${partNumber} IS compatible with model ${model}`
      : `✗ Part ${partNumber} is NOT compatible with model ${model}. This part is for a different model.`;
  },
  {
    name: "check_compatibility",
    description: "Check if a specific part is compatible with an appliance model",
    schema: z.object({
      partNumber: z.string().describe("Part number (e.g., PS11752778)"),
      model: z.string().describe("Appliance model number (e.g., WDT780SAEM1)")
    })
  }
);

/**
 * Tool: Get repair diagnosis from symptoms
 */
export const diagnosisTool = tool(
  async ({ model, symptoms }) => {
    const diagnosis = diagnoseFromSymptoms(model, symptoms, partsData);
    return diagnosis;
  },
  {
    name: "diagnose_repair",
    description:
      "Get suggested parts to fix a problem based on symptoms described",
    schema: z.object({
      model: z.string().describe("Appliance model number"),
      symptoms: z
        .array(z.string())
        .describe("List of symptoms or problems (e.g., ['ice maker not working', 'water leaking'])")
    })
  }
);

/**
 * Tool: Get installation instructions (repair video)
 */
export const getInstallationsTool = tool(
  async ({ partNumber, model }) => {
    if (!partsData[model]?.parts[partNumber]) {
      return `No installation data found for ${partNumber} on model ${model}`;
    }

    const part = partsData[model].parts[partNumber];
    
    if (part.repair_video_url) {
      return JSON.stringify({
        partNumber,
        name: part.name,
        videoUrl: part.repair_video_url,
        price: part.price,
        message: `Here's the installation video for ${part.name}:`
      }, null, 2);
    }
    
    return `No installation video available for ${part.name}. However, here are general installation steps:\n1. Unplug the appliance\n2. Remove the old part\n3. Install the new part\n4. Test the appliance`;
  },
  {
    name: "get_installation_instructions",
    description: "Get installation video and instructions for a specific part",
    schema: z.object({
      partNumber: z.string().describe("Part number (e.g., PS11752778)"),
      model: z.string().describe("Appliance model number")
    })
  }
);

/**
 * All available tools
 */
export const tools = [
  checkCompatibilityTool,
  diagnosisTool,
  getInstallationsTool
];

/**
 * Map tool names to actual tool objects for execution
 */
export const toolMap = {
  check_compatibility: checkCompatibilityTool,
  diagnose_repair: diagnosisTool,
  get_installation_instructions: getInstallationsTool
};