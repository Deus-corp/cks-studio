#!/usr/bin/env python3
"""Import the CKS ecosystem JSON and register it in the Graph Gallery."""
import json
import os
import sys
import urllib.request

MCP_URL = os.environ.get("MCP_URL", "http://127.0.0.1:8765") + "/mcp"
JSON_FILE = os.path.join(os.path.dirname(__file__), "cks-ecosystem.json")

if not os.path.exists(JSON_FILE):
    print(f"File {JSON_FILE} not found.", file=sys.stderr)
    sys.exit(1)

def mcp_call(payload):
    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

# 1. Load the graph JSON
with open(JSON_FILE, "r", encoding="utf-8") as f:
    raw = json.load(f)

# --- Normalize: accept both raw KnowledgeStructure and serialize result
if "serialized" in raw:
    graph_json = json.loads(raw["serialized"])
elif "objects" in raw:
    graph_json = raw
else:
    print("Error: JSON must contain 'objects' or 'serialized' key.", file=sys.stderr)
    sys.exit(1)

# 2. Create session with validate_knowledge
print("Creating session...")
result = mcp_call({
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "validate_knowledge",
        "arguments": {"json_data": json.dumps(graph_json)},
    },
})

try:
    text = result["result"]["content"][0]["text"]
    session_id = json.loads(text)["session_id"]
except (KeyError, json.JSONDecodeError) as e:
    print(f"Failed to extract session_id: {e}", file=sys.stderr)
    print("Response:", json.dumps(result, indent=2))
    sys.exit(1)

print(f"Session ID: {session_id}")

# 3. Register graph in gallery
print("Registering 'cks-ecosystem' in gallery...")
reg = mcp_call({
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "register_graph",
        "arguments": {
            "name": "cks-ecosystem",
            "session_id": session_id,
            "description": "Complete knowledge graph of the CKS ecosystem (core, runtime, mcp)",
            "tags": "cks,ecosystem,architecture",
            "public": True,
        },
    },
})

print(json.dumps(reg, indent=2))
print("Graph 'cks-ecosystem' is now in the Gallery.")