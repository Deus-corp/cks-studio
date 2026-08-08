#!/usr/bin/env bash
set -euo pipefail
MCP_URL="${MCP_URL:-http://127.0.0.1:8765}"

echo "Importing CKS ecosystem graph..."

# Читаем JSON из файла, который вы сохранили ранее (я предполагаю, что он лежит рядом)
JSON_FILE="scripts/cks-ecosystem.json"
if [ ! -f "$JSON_FILE" ]; then
  echo "File $JSON_FILE not found. Please save the ecosystem graph JSON to this path." >&2
  exit 1
fi

# Экранируем JSON для вставки в другой JSON
JSON_DATA=$(python3 -c "import json; print(json.dumps(open('$JSON_FILE').read()))")

# Создаём сессию через validate_knowledge
RESPONSE=$(curl -s -f -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"validate_knowledge\",
      \"arguments\": {
        \"json_data\": $JSON_DATA
      }
    }
  }")

SESSION_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(JSON.parse(d).result.content[0].text);console.log(r.session_id)})")

echo "Imported session: $SESSION_ID"

# Регистрируем граф как публичный
echo "Registering graph 'cks-ecosystem' in gallery..."
curl -s -f -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"register_graph\",
      \"arguments\": {
        \"name\": \"cks-ecosystem\",
        \"session_id\": \"$SESSION_ID\",
        \"description\": \"Complete knowledge graph of the CKS ecosystem (core, runtime, mcp)\",
        \"tags\": \"cks,ecosystem,architecture\",
        \"public\": true
      }
    }
  }"

echo ""
echo "Graph 'cks-ecosystem' is now available in the Gallery."
echo "Session ID: $SESSION_ID"