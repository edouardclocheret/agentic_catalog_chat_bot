// Using built-in fetch (Node.js 18+)
const API_URL = 'http://localhost:3001/api/chat';

async function makeRequest(message, sessionId = null) {
  const payload = { message };
  if (sessionId) {
    payload.sessionId = sessionId;
  }

  console.log(`\n📤 Sending: "${message}"`);
  if (sessionId) {
    console.log(`   With sessionId: ${sessionId}`);
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`\n📥 Response:`);
    console.log(`   ${data.message}`);
    console.log(`   Session ID: ${data.sessionId}`);

    return data;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return null;
  }
}

async function testAPIMemoryPersistence() {
  console.log('🧪 Testing API Memory Persistence\n');
  console.log('Make sure the server is running on http://localhost:3001\n');

  let sessionId = null;

  // Turn 1: Provide goal and model
  console.log('━'.repeat(70));
  console.log("TURN 1: User says 'I need to install a part for my WDT780SAEM1'");
  console.log('━'.repeat(70));
  let result = await makeRequest('I need to install a part for my WDT780SAEM1', sessionId);
  if (!result) return;
  sessionId = result.sessionId;

  // Turn 2: Provide part number
  console.log('\n' + '━'.repeat(70));
  console.log("TURN 2: User says 'The part number is PS3406971'");
  console.log('━'.repeat(70));
  result = await makeRequest('The part number is PS3406971', sessionId);
  if (!result) return;

  // Turn 3: Add symptoms
  console.log('\n' + '━'.repeat(70));
  console.log("TURN 3: User says 'I also have a leaking problem'");
  console.log('━'.repeat(70));
  result = await makeRequest('I also have a leaking problem', sessionId);
  if (!result) return;

  // Turn 4: Random message
  console.log('\n' + '━'.repeat(70));
  console.log("TURN 4: User says 'Tell me more'");
  console.log('━'.repeat(70));
  result = await makeRequest('Tell me more', sessionId);
  if (!result) return;

  console.log('\n' + '✅'.repeat(35));
  console.log('✅ Test complete! Check the server logs to verify memory was preserved.');
  console.log('✅'.repeat(35));
}

testAPIMemoryPersistence().catch(console.error);
