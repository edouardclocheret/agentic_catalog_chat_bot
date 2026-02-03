import { runAgent } from "./agent/agent-v2.js";

async function testGoalMemory() {
  console.log("\n" + "=".repeat(70));
  console.log("TEST: Goal Preserved in Memory Across Turns");
  console.log("=".repeat(70));

  const session = {
    messages: [],
    productModel: null,
    partNumber: null,
    symptoms: [],
    goalType: null
  };

  console.log("\n" + "━".repeat(70));
  console.log("TURN 1: User states goal explicitly");
  console.log("━".repeat(70));
  let response = await runAgent(session, "Help me install PS3406971");
  console.log(`\n📝 User said: "Help me install PS3406971"`);
  console.log(`📤 Agent response: ${response.substring(0, 100)}...`);
  console.log(`💾 Session state: goal=${session.goalType}, model=${session.productModel}, part=${session.partNumber}`);

  console.log("\n" + "━".repeat(70));
  console.log("TURN 2: User provides model (without restating goal)");
  console.log("━".repeat(70));
  response = await runAgent(session, "It's a WDT780SAEM1");
  console.log(`\n📝 User said: "It's a WDT780SAEM1"`);
  console.log(`📤 Agent response: ${response.substring(0, 200)}...`);
  console.log(`💾 Session state: goal=${session.goalType}, model=${session.productModel}, part=${session.partNumber}`);

  console.log("\n" + "━".repeat(70));
  console.log("RESULT");
  console.log("━".repeat(70));
  
  if (session.goalType === "install_instruction") {
    console.log("✅ SUCCESS: Goal 'install_instruction' preserved!");
  } else {
    console.log(`❌ FAILURE: Goal not preserved. Expected 'install_instruction', got '${session.goalType}'`);
  }

  if (session.productModel === "WDT780SAEM1" && session.partNumber === "PS3406971") {
    console.log("✅ SUCCESS: All fields preserved (model and part)!");
  } else {
    console.log(`❌ FAILURE: Fields not preserved correctly`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TEST COMPLETE");
  console.log("=".repeat(70) + "\n");
}

testGoalMemory().catch(console.error);
