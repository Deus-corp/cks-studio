#!/usr/bin/env bash
set -euo pipefail
MCP_URL="${MCP_URL:-http://127.0.0.1:8765}"

echo "Creating demo session..."
RESPONSE=$(curl -s -f -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -d @scripts/demo-session-payload.json)

SESSION_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(JSON.parse(d).result.content[0].text);console.log(r.session_id)})")

if [ -z "$SESSION_ID" ]; then
  echo "Error: could not extract session_id from response" >&2
  exit 1
fi

echo "Session ID: $SESSION_ID"

# Добавляем pipeline-объект
echo "Adding pipeline object..."
PIPELINE_PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "evolve_knowledge",
    "arguments": {
      "session_id": "$SESSION_ID",
      "operations": [
        {
          "type": "add_object",
          "identity": {"id": "pipe-1", "type": "Claim", "name": "LLMs need canonical grounding"},
          "structure": {
            "statement": "Language models benefit from a verifiable knowledge structure.",
            "current_status": "awaiting_review",
            "transition_log": [
              {"agent": "ResearcherAgent", "action": "researched", "transitioned_to": "awaiting_review", "timestamp": "2026-08-08T12:00:00Z"}
            ]
          }
        },
        {
          "type": "add_relation",
          "identity": {"id": "rel-pipe", "type": "Relation", "name": "depends_on"},
          "participants": ["pipe-1", "concept-1"],
          "relation_type": "depends_on",
          "structure": {}
        }
      ]
    }
  }
}
EOF
)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "$PIPELINE_PAYLOAD")

if [ "$HTTP_CODE" != "200" ]; then
  echo "Error adding pipeline object (HTTP $HTTP_CODE)" >&2
  exit 1
fi

echo "Demo session ready. Use session_id: $SESSION_ID"