import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import nodemailer from "nodemailer";

// Load parts data
const partsData = JSON.parse(fs.readFileSync("./data/parts.json"));

// Lazy-loaded email transporter (initialized on first use)
let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error("Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env");
    }
    
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return transporter;
}

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
 * Tool: Email conversation summary
 */
export const emailSummaryTool = tool(
  async ({ email, conversationSummary }) => {
    console.log(`[EMAIL] Sending summary to: ${email}`);
    
    try {
      // Get transporter (will validate credentials)
      const emailTransporter = getTransporter();

      // Format the conversation summary into pretty HTML (remove JSON objects)
      let cleanSummary = conversationSummary
        // Remove JSON objects and code blocks
        .replace(/\{[\s\S]*?\}/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]*`/g, '')
        // Clean up extra whitespace
        .split('\n')
        .filter(line => line.trim().length > 0)
        .join('\n');

      const formattedSummary = cleanSummary
        .split('\n')
        .map(line => {
          if (!line.trim()) return '<br>';
          if (line.startsWith('**')) {
            return `<h3 style="color: #1b3875; margin-top: 15px; margin-bottom: 8px;">${line.replace(/\*\*/g, '')}</h3>`;
          }
          if (line.startsWith('- ')) {
            return `<li style="margin: 6px 0;">${line.substring(2)}</li>`;
          }
          if (line.includes('http') || line.includes('.jpg') || line.includes('.png')) {
            return `<img src="${line.trim()}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;" alt="Conversation image">`;
          }
          return `<p style="margin: 10px 0;">${line}</p>`;
        })
        .join('');

      // Send email with formatted HTML
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your PartSelect Support Conversation Summary",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
                .container { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 40px 20px; min-height: 100vh; }
                .email-wrapper { background-color: white; max-width: 600px; margin: 0 auto; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
                .header { background: linear-gradient(135deg, #1b3875 0%, #2d5a9e 100%); color: white; padding: 40px 20px; text-align: center; }
                .header h2 { margin: 0; font-size: 28px; font-weight: 600; }
                .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
                .content { padding: 40px 30px; }
                .intro { font-size: 16px; color: #555; margin-bottom: 20px; line-height: 1.8; }
                .summary-section { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-left: 5px solid #1b3875; border-radius: 8px; margin: 20px 0; }
                .summary-section h3 { color: #1b3875; margin-top: 0; margin-bottom: 12px; font-size: 18px; }
                .summary-section ul { margin: 10px 0; padding-left: 20px; }
                .summary-section li { margin: 8px 0; color: #333; }
                .summary-section p { margin: 10px 0; color: #555; }
                .summary-section img { margin: 15px 0; border-radius: 6px; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e9ecef; }
                .footer a { color: #1b3875; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="email-wrapper">
                  <div class="header">
                    <h2>📋 PartSelect Support Summary</h2>
                    <p>Your conversation has been archived</p>
                  </div>
                  <div class="content">
                    <p class="intro">Thank you for using PartSelect support! Below is a complete summary of your conversation, recommendations, and any resources we discussed:</p>
                    <div class="summary-section">
                      ${formattedSummary}
                    </div>
                  </div>
                  <div class="footer">
                    <p style="margin: 0 0 10px 0;">
                      <strong>Need more help?</strong> Visit <a href="https://partselect.com">partselect.com</a> or contact our support team.
                    </p>
                    <p style="margin: 0; opacity: 0.7;">
                      This is an automated email. Please don't reply directly to this address.
                    </p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `
      });

      console.log(`[EMAIL] ✓ Successfully sent to ${email}`);
      
      return JSON.stringify({
        success: true,
        email,
        message: `✓ Conversation summary has been sent to ${email}. Check your inbox for the details.`,
        timestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      console.error(`[EMAIL] ✗ Failed to send email:`, error.message);
      
      return JSON.stringify({
        success: false,
        email,
        message: `✗ Failed to send email: ${error.message}`,
        error: error.message
      }, null, 2);
    }
  },
  {
    name: "email_summary",
    description: "Email a summary of the conversation to the user",
    schema: z.object({
      email: z.string().email().describe("User's email address"),
      conversationSummary: z.string().describe("Summary of the conversation and recommendations")
    })
  }
);

/**
 * All available tools
 */
export const tools = [
  checkCompatibilityTool,
  diagnosisTool,
  getInstallationsTool,
  emailSummaryTool
];

/**
 * Map tool names to actual tool objects for execution
 */
export const toolMap = {
  check_compatibility: checkCompatibilityTool,
  diagnose_repair: diagnosisTool,
  get_installation_instructions: getInstallationsTool,
  email_summary: emailSummaryTool

};