import { runAgent } from "../agent/agent.js";

async function testMemoryPersistence() {
  console.log("🧪 Testing Memory Persistence\n");

  const sessionState = {
    messages: [],
    partNumber: null,
    productModel: null,
    symptoms: [],
    goalType: null
  };

  // Turn 1: User provides goal and model
  console.log("━".repeat(60));
  console.log("TURN 1: User says 'I need to install a part for my WDT780SAEM1'");
  console.log("━".repeat(60));
  let reply = await runAgent(sessionState, "I need to install a part for my WDT780SAEM1");
  console.log("\n📤 Agent response:", reply);
  console.log("\n💾 Session state after Turn 1:");
  console.log(`   Model: ${sessionState.productModel}`);
  console.log(`   Goal: ${sessionState.goalType}`);
  console.log(`   Part: ${sessionState.partNumber}`);
  console.log(`   Symptoms: ${JSON.stringify(sessionState.symptoms)}`);

  // Turn 2: User provides part number only (should preserve model and goal)
  console.log("\n" + "━".repeat(60));
  console.log("TURN 2: User says 'The part number is PS3406971'");
  console.log("━".repeat(60));
  reply = await runAgent(sessionState, "The part number is PS3406971");
  console.log("\n📤 Agent response:", reply);
  console.log("\n💾 Session state after Turn 2:");
  console.log(`   Model: ${sessionState.productModel} (should still be WDT780SAEM1)`);
  console.log(`   Goal: ${sessionState.goalType} (should still be install_instruction)`);
  console.log(`   Part: ${sessionState.partNumber} (should be PS3406971)`);
  console.log(`   Symptoms: ${JSON.stringify(sessionState.symptoms)}`);

  // Turn 3: User provides symptoms but model and goal should remain locked
  console.log("\n" + "━".repeat(60));
  console.log("TURN 3: User says 'I have a leaking problem'");
  console.log("━".repeat(60));
  reply = await runAgent(sessionState, "I have a leaking problem");
  console.log("\n📤 Agent response:", reply);
  console.log("\n💾 Session state after Turn 3:");
  console.log(`   Model: ${sessionState.productModel} (should still be WDT780SAEM1)`);
  console.log(`   Goal: ${sessionState.goalType} (should still be install_instruction)`);
  console.log(`   Part: ${sessionState.partNumber} (should still be PS3406971)`);
  console.log(`   Symptoms: ${JSON.stringify(sessionState.symptoms)} (should include 'leaking')`);

  console.log("\n✅ Memory persistence test complete!");
}

testMemoryPersistence().catch(console.error);
