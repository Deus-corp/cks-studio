// Copyright (c) 2025 Deus Corp. Licensed under MIT.

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: number
  method: string
  params: { name: string; arguments: Record<string, unknown> }
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: number
  result?: { content: { type: string; text: string }[] }
  error?: { code: number; message: string }
}

// В будущем заменим на реальный HTTP/stdio вызов
export async function callTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Пока делегируем моку
  const { mockCallTool } = await import('./mockData')
  return mockCallTool(toolName, args)
}