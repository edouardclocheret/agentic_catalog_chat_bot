#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing API Session Memory Persistence${NC}\n"

SESSION_ID=""
API_URL="http://localhost:3001/api/chat"

# Turn 1
echo -e "${GREEN}━━ TURN 1: Provide goal and model ━━${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"message":"I need to install a part for my WDT780SAEM1"}')

SESSION_ID=$(echo "$RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
echo "Session ID: $SESSION_ID"
echo ""

# Turn 2
echo -e "${GREEN}━━ TURN 2: Provide part number (session should have goal) ━━${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"The part number is PS3406971\",\"sessionId\":\"$SESSION_ID\"}")

echo "Response received (check server logs for memory state)"
echo ""

# Turn 3
echo -e "${GREEN}━━ TURN 3: Add symptoms (session should have model, part, goal) ━━${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"I also have a leaking problem\",\"sessionId\":\"$SESSION_ID\"}")

echo "Response received (check server logs for memory state)"
echo ""

echo -e "${GREEN}✅ Test complete! Check the server terminal output above.${NC}"
echo -e "${GREEN}Look for [SERVER] logs showing:${NC}"
echo -e "${GREEN}  - Using EXISTING session${NC}"
echo -e "${GREEN}  - Current goalType should NOT be null${NC}"
