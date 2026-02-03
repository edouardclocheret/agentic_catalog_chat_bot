import { runAgent } from "../agent/agent.js";

async function testMemoryNeverCleared() {
  console.log("🧪 Testing Memory Never Gets Cleared\n");

  const sessionState = {
    messages: [],
    partNumber: null,
    productModel: null,
    symptoms: [],
    goalType: null
  };

  // Turn 1: User provides goal and model
  console.log("━".repeat(70));
  console.log("TURN 1: User says 'I need to install a part for my WDT780SAEM1'");
  console.log("━".repeat(70));
  let reply = await runAgent(sessionState, "I need to install a part for my WDT780SAEM1");
  console.log("\n✅ Session memory after Turn 1:");
  console.log(`   Model: ${sessionState.productModel || "MISSING"}`);
  console.log(`   Goal: ${sessionState.goalType || "MISSING"}`);
  console.log(`   Part: ${sessionState.partNumber || "MISSING"}`);

  if (!sessionState.productModel || !sessionState.goalType) {
    console.error("❌ FAILED: Memory was cleared!");
    return;
  }

  // Turn 2: User provides part number
  console.log("\n" + "━".repeat(70));
  console.log("TURN 2: User says 'The part number is PS3406971'");
  console.log("━".repeat(70));
  reply = await runAgent(sessionState, "The part number is PS3406971");
  console.log("\n✅ Session memory after Turn 2:");
  console.log(`   Model: ${sessionState.productModel || "MISSING"}`);
  console.log(`   Goal: ${sessionState.goalType || "MISSING"}`);
  console.log(`   Part: ${sessionState.partNumber || "MISSING"}`);

  if (!sessionState.productModel || !sessionState.goalType || !sessionState.partNumber) {
    console.error("❌ FAILED: Memory was cleared!");
    return;
  }

  // Turn 3: User adds symptoms
  console.log("\n" + "━".repeat(70));
  console.log("TURN 3: User says 'I also have a leaking problem'");
  console.log("━".repeat(70));
  reply = await runAgent(sessionState, "I also have a leaking problem");
  console.log("\n✅ Session memory after Turn 3:");
  console.log(`   Model: ${sessionState.productModel || "MISSING"}`);
  console.log(`   Goal: ${sessionState.goalType || "MISSING"}`);
  console.log(`   Part: ${sessionState.partNumber || "MISSING"}`);
  console.log(`   Symptoms: ${JSON.stringify(sessionState.symptoms)}`);

  if (!sessionState.productModel || !sessionState.goalType || !sessionState.partNumber) {
    console.error("❌ FAILED: Memory was cleared!");
    return;
  }

  // Turn 4: User says something random that shouldn't affect memory
  console.log("\n" + "━".repeat(70));
  console.log("TURN 4: User says 'Tell me more about the installation'");
  console.log("━".repeat(70));
  reply = await runAgent(sessionState, "Tell me more about the installation");
  console.log("\n✅ Session memory after Turn 4:");
  console.log(`   Model: ${sessionState.productModel || "MISSING"}`);
  console.log(`   Goal: ${sessionState.goalType || "MISSING"}`);
  console.log(`   Part: ${sessionState.partNumber || "MISSING"}`);
  console.log(`   Symptoms: ${JSON.stringify(sessionState.symptoms)}`);

  if (!sessionState.productModel || !sessionState.goalType || !sessionState.partNumber) {
    console.error("❌ FAILED: Memory was cleared in Turn 4!");
    return;
  }

  // Turn 5: Another random message
  console.log("\n" + "━".repeat(70));
  console.log("TURN 5: User says 'Thanks!'");
  console.log("━".repeat(70));
  reply = await runAgent(sessionState, "Thanks!");
  console.log("\n✅ Session memory after Turn 5:");
  console.log(`   Model: ${sessionState.productModel || "MISSING"}`);
  console.log(`   Goal: ${sessionState.goalType || "MISSING"}`);
  console.log(`   Part: ${sessionState.partNumber || "MISSING"}`);
  console.log(`   Symptoms: ${JSON.stringify(sessionState.symptoms)}`);

  if (!sessionState.productModel || !sessionState.goalType || !sessionState.partNumber) {
    console.error("❌ FAILED: Memory was cleared in Turn 5!");
    return;
  }

  console.log("\n" + "✅".repeat(35));
  console.log("✅ SUCCESS: Memory was NEVER cleared across all turns!");
  console.log("✅".repeat(35));
}

testMemoryNeverCleared().catch(console.error);
