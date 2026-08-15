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

# Persistent dev database: lives under $HOME/.cks-mcp so graphs
# registered in the Gallery (register_graph/clone_graph) survive
# machine reboots and cks-mcp restarts, instead of being wiped like a
# /tmp path would be. Override with CKS_MCP_DB_PATH if you want a
# throwaway/scratch DB for a particular session.
CKS_MCP_DB_DIR="${CKS_MCP_DB_DIR:-$HOME/.cks-mcp}"
mkdir -p "$CKS_MCP_DB_DIR"

CKS_MCP_HTTP_PORT="${CKS_MCP_HTTP_PORT:-8765}" \
CKS_MCP_DB_PATH="${CKS_MCP_DB_PATH:-$CKS_MCP_DB_DIR/cks_mcp.db}" \
exec cks-mcp

# Automatically create a session if AUTO_CREATE_SESSION is set
if [ "${AUTO_CREATE_SESSION:-}" = "true" ]; then
  echo "Creating test session..."
  python "$MCP_DIR/scripts/create_session.py" --db-path="$CKS_MCP_DB_PATH"
fi