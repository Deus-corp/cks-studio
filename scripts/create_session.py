import json
import os
import sys
import subprocess

DB_PATH = os.environ.get("CKS_MCP_DB_PATH", "/tmp/cks-studio-dev.db")
# Можно переопределить первым аргументом командной строки
if len(sys.argv) > 1 and sys.argv[1].startswith("--db-path="):
    DB_PATH = sys.argv[1].split("=", 1)[1]
elif len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
    # Просто путь как аргумент
    DB_PATH = sys.argv[1]

print(f"Using database: {DB_PATH}", file=sys.stderr)

request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "validate_knowledge",
        "arguments": {
            "json_data": json.dumps({
                "objects": [
                    {
                        "identity": {
                            "id": "concept-1",
                            "type": "Concept",
                            "name": "Test Concept"
                        },
                        "structure": {"description": "Initial version"}
                    }
                ]
            })
        }
    }
}

proc = subprocess.Popen(
    ["cks-mcp"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True,
    env={
        **os.environ,
        "CKS_MCP_DB_PATH": DB_PATH,
        "CKS_GOSSIP_ENABLED": "false",
    }
)

proc.stdin.write(json.dumps(request) + "\n")
proc.stdin.flush()

response_line = proc.stdout.readline()
proc.terminate()
stderr_output = proc.stderr.read()

if not response_line:
    print("No response from cks-mcp subprocess. stderr:")
    print(stderr_output)
    raise SystemExit(1)

response = json.loads(response_line)
print("Full response:", json.dumps(response, indent=2))

if "result" in response:
    result_text = response["result"]["content"][0]["text"]
    result_json = json.loads(result_text)
    print("session_id:", result_json.get("session_id"))