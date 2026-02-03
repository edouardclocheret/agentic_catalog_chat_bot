#!/usr/bin/env node

/**
 * Test the LangGraph agent directly without starting the server
 */

import { runAgent } from "./agent/agent.js";

const testSessionState = {
  messages: [],
  partNumber: null,
  productModel: null,
  symptoms: []
};

async function runTest() {
  console.log("🧪 Testing LangGraph Agent\n");

  try {
    // Test 1: Ask about fixing ice maker
    console.log("Test 1: Troubleshooting query");
    console.log('User: "My ice maker is not working, model is WDT780SAEM1"');
    const response1 = await runAgent(testSessionState, "My ice maker is not working, model is WDT780SAEM1");
    console.log(`Agent: ${response1.substring(0, 150)}...\n`);

    // Test 2: Ask for installation help
    console.log("Test 2: Installation query");
    console.log('User: "How do I install PS11752778?"');
    const response2 = await runAgent(testSessionState, "How do I install PS11752778?");
    console.log(`Agent: ${response2.substring(0, 150)}...\n`);

    console.log("✅ Tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
