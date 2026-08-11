// Copyright (c) 2025 Deus Corp. Licensed under MIT.

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: number
  result?: { content: { type: string; text: string }[] }
  error?: { code: number; message: string }
}

let _baseUrl = 'http://127.0.0.1:8765'

export function setMCPBaseUrl(url: string) {
  _baseUrl = url.replace(/\/$/, '')
}

/**
 * Demo mode (see src/demo.tsx / src/services/mockClient.ts): when the
 * static GitHub Pages demo is running there is no cks-mcp server to talk
 * to, so every callTool() is routed to the in-memory mock client instead
 * of hitting the network. Nothing outside demo.tsx should ever call this.
 */
let _demoCallTool: typeof callTool | null = null

export function setDemoCallTool(fn: typeof callTool | null) {
  _demoCallTool = fn
}

export async function callTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (_demoCallTool) {
    return _demoCallTool(toolName, args)
  }

  const response = await fetch(`${_baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `MCP request failed: ${response.status} ${response.statusText}`,
    )
  }

  const data: JsonRpcResponse = await response.json()

  if (data.error) {
    throw new Error(`MCP error ${data.error.code}: ${data.error.message}`)
  }

  if (data.result?.content?.[0]) {
    try {
      return JSON.parse(data.result.content[0].text)
    } catch {
      return { raw: data.result.content[0].text }
    }
  }

  return {}
}
