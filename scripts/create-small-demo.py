#!/usr/bin/env python3
import json, urllib.request, os

MCP_URL = os.environ.get("MCP_URL", "http://127.0.0.1:8765") + "/mcp"

def mcp_call(payload):
    req = urllib.request.Request(MCP_URL, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

result = mcp_call({
    "jsonrpc": "2.0", "id": 1, "method": "tools/call",
    "params": {"name": "validate_knowledge", "arguments": {"json_data": json.dumps({
        "objects": [
            {"identity": {"id": "planet-earth", "type": "Planet", "name": "Earth"}, "structure": {"type": "terrestrial"}},
            {"identity": {"id": "star-sun", "type": "Star", "name": "Sun"}, "structure": {"spectral_type": "G2V"}},
            {"identity": {"id": "rel-orbits", "type": "Relation", "name": "Earth orbits Sun"}, "structure": {"participants": ["planet-earth", "star-sun"], "relation_type": "orbits"}}
        ]
    })}}
})
session_id = json.loads(result["result"]["content"][0]["text"])["session_id"]
print(f"Demo session ID: {session_id}")