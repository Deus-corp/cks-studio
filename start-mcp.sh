#!/usr/bin/env bash
# Start cks-mcp with HTTP transport for local development with cks-studio.
# Uses the existing Python virtual environment from cks-mcp.

MCP_DIR="$HOME/Desktop/cks-mcp"
VENV="$MCP_DIR/.venv312/bin/activate"

if [ ! -f "$VENV" ]; then
  echo "Virtual environment not found at $VENV" >&2
  exit 1
fi

source "$VENV"

CKS_MCP_HTTP_PORT="${CKS_MCP_HTTP_PORT:-8765}" \
CKS_MCP_DB_PATH="${CKS_MCP_DB_PATH:-/tmp/cks-studio-dev.db}" \
exec cks-mcp

# Automatically create a session if AUTO_CREATE_SESSION is set
if [ "${AUTO_CREATE_SESSION:-}" = "true" ]; then
  echo "Creating test session..."
  python "$MCP_DIR/scripts/create_session.py" --db-path="$CKS_MCP_DB_PATH"
fi