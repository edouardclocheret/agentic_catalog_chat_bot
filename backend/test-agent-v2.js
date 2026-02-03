import { runAgent } from "./agent/agent.js";

async function testAgent() {
  const session = {
    messages: [],
    productModel: null,
    partNumber: null,
    symptoms: [],
    goalType: null
  };

  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: User provides model and symptoms (triggers diagnose)");
  console.log("=".repeat(70));
  
  let response = await runAgent(session, "My WDT780SAEM1 dishwasher is leaking");
  console.log(`\nAgent: ${response}\n`);

  console.log("\n" + "=".repeat(70));
  console.log("TEST 2: User clarifies they want to fix it (goal set)");
  console.log("=".repeat(70));
  
  response = await runAgent(session, "I want to fix it");
  console.log(`\nAgent: ${response}\n`);

  console.log("\n" + "=".repeat(70));
  console.log("Memory after tests:");
  console.log("=".repeat(70));
  console.log(`Model: ${session.productModel}`);
  console.log(`Part: ${session.partNumber}`);
  console.log(`Symptoms: ${session.symptoms.join(", ")}`);
  console.log(`Goal: ${session.goalType}`);
}

testAgent().catch(console.error);
