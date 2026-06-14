import type { WorkspaceCommand, WorkspaceCommandResult, BridgeError } from '../../types/mcp/models';
import { workspaceCommandAdapter } from '../../types/mcp/models';

export interface McpSession {
  sessionId: string;
  serverUrl: string;
  capabilities: Record<string, unknown>;
  initialized: boolean;
  createdAt: number;
}

export interface McpMessage {
  id: string;
  jsonrpc: string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class McpProtocol {
  private sessions: Map<string, McpSession> = new Map();

  encodeJsonRpcRequest(method: string, params: unknown, id?: string): string {
    const message: McpMessage = {
      id: id || this.generateRequestId(),
      jsonrpc: '2.0',
      method,
      params,
    };
    return JSON.stringify(message);
  }

  encodeJsonRpcResponse(result: unknown, id: string): string {
    const message: McpMessage = {
      id,
      jsonrpc: '2.0',
      result,
    };
    return JSON.stringify(message);
  }

  encodeJsonRpcError(code: number, errorMessage: string, id: string, data?: unknown): string {
    const msg: McpMessage = {
      id,
      jsonrpc: '2.0',
      error: { code, message: errorMessage, data },
    };
    return JSON.stringify(msg);
  }

  decodeJsonRpcMessage(data: string): McpMessage {
    try {
      return JSON.parse(data);
    } catch {
      throw new Error('Invalid JSON-RPC message');
    }
  }

  parseSseStream(chunk: string): McpMessage[] {
    const messages: McpMessage[] = [];
    const lines = chunk.split('\n');
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        currentData += line.slice(5).trim();
      } else if (line === '' && currentData) {
        try {
          messages.push(this.decodeJsonRpcMessage(currentData));
        } catch {
        }
        currentData = '';
      }
    }

    if (currentData) {
      try {
        messages.push(this.decodeJsonRpcMessage(currentData));
      } catch {
      }
    }

    return messages;
  }

  generateRequestId(): string {
    return `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  generateSessionId(): string {
    return `session_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  createSession(serverUrl: string): McpSession {
    const sessionId = this.generateSessionId();
    const session: McpSession = {
      sessionId,
      serverUrl,
      capabilities: {},
      initialized: false,
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSessionCapabilities(sessionId: string, capabilities: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.capabilities = capabilities;
      session.initialized = true;
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  validateWorkspaceCommand(command: unknown): WorkspaceCommand {
    const result = workspaceCommandAdapter.safeParse(command);
    if (!result.success) {
      throw new Error(`Invalid workspace command: ${result.error.message}`);
    }
    return result.data;
  }

  createInitializeRequest(_sessionId: string): string {
    return JSON.stringify({
      id: this.generateRequestId(),
      jsonrpc: '2.0',
      method: 'tools/list',
    });
  }

  createToolsListRequest(): string {
    return JSON.stringify({
      id: this.generateRequestId(),
      jsonrpc: '2.0',
      method: 'tools/list',
    });
  }

  createToolsCallRequest(toolName: string, arguments_: Record<string, unknown>): string {
    return this.encodeJsonRpcRequest('tools/call', { name: toolName, arguments: arguments_ });
  }

  createCommandResult(
    ok: boolean,
    command: string,
    requestId: string | undefined,
    message: string,
    data?: unknown,
    error?: BridgeError
  ): WorkspaceCommandResult {
    return {
      ok,
      command,
      request_id: requestId,
      message,
      data,
      error,
    };
  }
}

export const mcpProtocol = new McpProtocol();
