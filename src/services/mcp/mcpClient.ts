import { mcpProtocol } from './mcpProtocol';
import type { ToolResponse } from './responseFormatter';
import { responseFormatter } from './responseFormatter';

// BridgeError-compatible error adapter
function fromMcpError(error: unknown): { code: 'command_failed' | 'unknown'; message: string; retryable: false } {
  if (error instanceof Error) {
    return { code: 'command_failed', message: error.message, retryable: false };
  }
  return { code: 'unknown', message: String(error), retryable: false };
}

function unauthorizedError(message: string): { code: 'unauthorized'; message: string; retryable: false } {
  return { code: 'unauthorized', message, retryable: false };
}

export interface McpServerConnection {
  serverUrl: string;
  sessionId: string;
  headers: Record<string, string>;
  connected: boolean;
  lastConnectedAt: number | null;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverName: string;
  enabled: boolean;
}

export class McpClient {
  private connections: Map<string, McpServerConnection> = new Map();
  private tools: Map<string, McpTool[]> = new Map();
  private defaultTimeout = 10000;

  async connect(serverUrl: string, headers: Record<string, string> = {}): Promise<McpServerConnection> {
    const session = mcpProtocol.createSession(serverUrl);
    
    try {
      const response = await this.sendRequest(serverUrl, mcpProtocol.createInitializeRequest(session.sessionId), headers);
      const result = JSON.parse(response);
      
      if (result.error) {
        throw new Error(result.error.message || 'Connection failed');
      }

      const connection: McpServerConnection = {
        serverUrl,
        sessionId: session.sessionId,
        headers,
        connected: true,
        lastConnectedAt: Date.now(),
      };
      
      this.connections.set(session.sessionId, connection);
      mcpProtocol.updateSessionCapabilities(session.sessionId, result.result || {});
      
      await this.discoverTools(session.sessionId);
      
      return connection;
    } catch (error) {
      mcpProtocol.deleteSession(session.sessionId);
      throw error;
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.connected = false;
      this.connections.delete(sessionId);
      this.tools.delete(sessionId);
      mcpProtocol.deleteSession(sessionId);
    }
  }

  async discoverTools(sessionId: string): Promise<McpTool[]> {
    const connection = this.connections.get(sessionId);
    if (!connection || !connection.connected) {
      throw new Error('Not connected');
    }

    try {
      const response = await this.sendRequest(
        connection.serverUrl,
        mcpProtocol.createToolsListRequest(),
        connection.headers
      );
      
      const result = JSON.parse(response);
      
      if (result.error) {
        throw new Error(result.error.message || 'Failed to discover tools');
      }

      const resultData = result.result;
      if (!resultData || typeof resultData !== 'object') {
        throw new Error('Invalid response format');
      }

      const toolsArray = resultData.tools || resultData;
      if (!Array.isArray(toolsArray)) {
        throw new Error('Expected tools to be an array');
      }

      const tools: McpTool[] = toolsArray.map((tool: Record<string, unknown>) => ({
        name: tool.name as string,
        description: tool.description as string,
        inputSchema: (tool.inputSchema || tool.parameters) as Record<string, unknown>,
        serverName: connection.serverUrl,
        enabled: true,
      }));

      this.tools.set(sessionId, tools);
      return tools;
    } catch (error) {
      throw fromMcpError(error);
    }
  }

  async callTool(sessionId: string, toolName: string, arguments_: Record<string, unknown>): Promise<ToolResponse> {
    const connection = this.connections.get(sessionId);
    if (!connection || !connection.connected) {
      return responseFormatter.error(toolName, sessionId, unauthorizedError('Not connected'));
    }

    try {
      const request = mcpProtocol.createToolsCallRequest(toolName, arguments_);
      const response = await this.sendRequest(connection.serverUrl, request, connection.headers);
      const result = JSON.parse(response);

      if (result.error) {
        return responseFormatter.error(toolName, result.id || null, fromMcpError(new Error(result.error.message)));
      }

      return responseFormatter.success(toolName, result.id || null, 'Success', result.result);
    } catch (error) {
      return responseFormatter.error(toolName, sessionId, fromMcpError(error));
    }
  }

  getTools(sessionId: string): McpTool[] {
    return this.tools.get(sessionId) || [];
  }

  getConnection(sessionId: string): McpServerConnection | undefined {
    return this.connections.get(sessionId);
  }

  getConnections(): McpServerConnection[] {
    return Array.from(this.connections.values());
  }

  isConnected(sessionId: string): boolean {
    return this.connections.has(sessionId) && this.connections.get(sessionId)?.connected === true;
  }

  private async sendRequest(url: string, body: string, headers: Record<string, string>): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const response = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        return await this.parseSseResponse(response);
      } else {
        return await response.text();
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseSseResponse(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response body reader');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          return line.substring(6);
        }
      }
    }

    throw new Error('No data found in SSE response');
  }
}

export const mcpClient = new McpClient();
