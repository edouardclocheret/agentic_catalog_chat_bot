import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { isPartCompatible } from "../tools/compatibilityTool.js";
import { diagnoseFromSymptoms } from "../tools/diagnosisTool.js";
import fs from "fs";

// Load parts data
const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));

/**
 * Tool: Search for parts by keywords, symptoms, or part numbers
 */
export const searchPartsTool = tool(
  async ({ query, model }) => {
    const results = [];
    const queryLower = query.toLowerCase();

    if (!model || !partsData[model]) {
      return `Model ${model} not found in database`;
    }

    const modelParts = partsData[model].parts || {};

    for (const [partNum, partData] of Object.entries(modelParts)) {
      const matchName = partData.name?.toLowerCase().includes(queryLower);
      const matchSymptoms = partData.symptoms?.some(s =>
        s.toLowerCase().includes(queryLower)
      );
      const matchPartNum = partNum.toLowerCase().includes(queryLower);

      if (matchName || matchSymptoms || matchPartNum) {
        results.push({
          partNumber: partNum,
          name: partData.name,
          price: partData.price,
          symptoms: partData.symptoms || [],
          description: partData.description
        });
      }
    }

    return results.length > 0
      ? JSON.stringify(results, null, 2)
      : `No parts found matching "${query}" for model ${model}`;
  },
  {
    name: "search_parts",
    description:
      "Search for parts by keyword, symptom, or part number for a specific appliance model",
    schema: z.object({
      query: z
        .string()
        .describe("Search query - part name, symptom, or part number"),
      model: z.string().describe("Appliance model number (e.g., WDT780SAEM1)")
    })
  }
);

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
 * Tool: Get part details
 */
export const getPartDetailsTool = tool(
  async ({ partNumber, model }) => {
    if (!partsData[model]?.parts[partNumber]) {
      return `Part ${partNumber} not found for model ${model}`;
    }

    const part = partsData[model].parts[partNumber];
    return JSON.stringify(
      {
        partNumber,
        name: part.name,
        price: part.price,
        description: part.description,
        symptoms: part.symptoms,
        warranty: part.warranty,
        inStock: part.inStock !== false
      },
      null,
      2
    );
  },
  {
    name: "get_part_details",
    description: "Get detailed information about a specific part",
    schema: z.object({
      partNumber: z.string().describe("Part number (e.g., PS11752778)"),
      model: z.string().describe("Appliance model number")
    })
  }
);

/**
 * Tool: Extract part number and model from text
 */
export const extractInformationTool = tool(
  async ({ text }) => {
    const partMatch = text.match(/PS\d+/i);
    const modelMatch = text.match(/[A-Z]{3}\d{2,}/);

    return JSON.stringify(
      {
        partNumber: partMatch ? partMatch[0].toUpperCase() : null,
        model: modelMatch ? modelMatch[0] : null
      },
      null,
      2
    );
  },
  {
    name: "extract_information",
    description: "Extract part numbers and model numbers from user text",
    schema: z.object({
      text: z.string().describe("The text to extract information from")
    })
  }
);

/**
 * All available tools
 */
export const tools = [
  searchPartsTool,
  checkCompatibilityTool,
  diagnosisTool,
  getInstallationsTool,
  getPartDetailsTool,
  extractInformationTool
];

/**
 * Map tool names to actual tool objects for execution
 */
export const toolMap = {
  search_parts: searchPartsTool,
  check_compatibility: checkCompatibilityTool,
  diagnose_repair: diagnosisTool,
  get_installation_instructions: getInstallationsTool,
  get_part_details: getPartDetailsTool,
  extract_information: extractInformationTool
};
