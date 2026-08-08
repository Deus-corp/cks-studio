#!/usr/bin/env bash
# Запускает переданную команду, активировав виртуальное окружение cks-mcp.
MCP_DIR="$HOME/Desktop/cks-mcp"
VENV="$MCP_DIR/.venv312/bin/activate"

if [ ! -f "$VENV" ]; then
  echo "Virtual environment not found at $VENV" >&2
  exit 1
fi

source "$VENV"
exec "$@"