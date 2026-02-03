import { runAgent } from "../agent/agent.js";

async function testGoalPreservation() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST: Goal Preservation Across Turns");
  console.log("=".repeat(70));

  const session = {
    messages: [],
    productModel: null,
    partNumber: null,
    symptoms: [],
    goalType: null
  };

  console.log("\n--- TURN 1: User wants to install a part ---");
  let response = await runAgent(session, "Help me install PS3406971");
  console.log(`Agent: ${response.substring(0, 150)}...`);
  console.log(
    `\nSession after Turn 1: model=${session.productModel}, part=${session.partNumber}, goal=${session.goalType}`
  );

  console.log("\n--- TURN 2: User provides model (should remember install goal!) ---");
  response = await runAgent(session, "It's for a WDT780SAEM1");
  console.log(`Agent: ${response.substring(0, 150)}...`);
  console.log(
    `\nSession after Turn 2: model=${session.productModel}, part=${session.partNumber}, goal=${session.goalType}`
  );

  if (session.goalType === "install_instruction" && session.productModel === "WDT780SAEM1" && session.partNumber === "PS3406971") {
    console.log("\n✅ SUCCESS: Goal preserved! All fields remembered!");
  } else {
    console.log("\n❌ FAILURE: Goal not preserved correctly");
    console.log(`   Expected goal: install_instruction, got: ${session.goalType}`);
  }
}

testGoalPreservation().catch(console.error);
