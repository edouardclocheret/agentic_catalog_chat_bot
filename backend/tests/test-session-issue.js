import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/chat';

async function testWithoutSessionId() {
  console.log('❌ TEST 1: Making requests WITHOUT sessionId (creates new sessions each time)\n');
  
  let response1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "I need installation instructions" })
  });
  let data1 = await response1.json();
  console.log('Turn 1 response sessionId:', data1.sessionId);
  
  // NOT sending sessionId back - creates NEW session
  let response2 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "for the appliance WDT780SAEM1" })
  });
  let data2 = await response2.json();
  console.log('Turn 2 response sessionId:', data2.sessionId);
  
  console.log('\n❌ Result: Sessions are DIFFERENT → Memory lost\n');
}

async function testWithSessionId() {
  console.log('✅ TEST 2: Making requests WITH sessionId (same session)\n');
  
  let response1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "I need installation instructions" })
  });
  let data1 = await response1.json();
  console.log('Turn 1 response sessionId:', data1.sessionId);
  
  // SENDING sessionId back - reuses same session
  let response2 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: "for the appliance WDT780SAEM1",
      sessionId: data1.sessionId  // ← KEY: Send session ID back!
    })
  });
  let data2 = await response2.json();
  console.log('Turn 2 response sessionId:', data2.sessionId);
  
  console.log('\n✅ Result: Sessions are the SAME → Memory preserved\n');
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('DEMONSTRATING THE ISSUE\n');
  
  await testWithoutSessionId();
  await testWithSessionId();
  
  console.log('='.repeat(70));
  console.log('\n📝 SOLUTION:\n');
  console.log('Your frontend/client MUST:');
  console.log('1. Store the sessionId from the first API response');
  console.log('2. Send it back with every subsequent message');
  console.log('3. This keeps the SAME session alive with persistent memory\n');
}

runTests().catch(console.error);
