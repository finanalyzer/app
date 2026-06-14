import type {
  AgentConnection,
  AgentsResponse,
  HealthStatus,
  QueryRequest,
  AgentEvent,
  ReasoningStep,
  MessageChunk,
  ToolCall,
  QueryMessage,
} from "../../types/ai";
import { connectionService } from "../connections/connectionService";
import { mcpClient } from "../mcp/mcpClient";
import { mcpToolRegistry } from "../mcp/mcpToolRegistry";

const AGENT_API_PATHS = {
  agentsJson: "/agents.json",
  health: "/health",
  query: "/v1/query",
  terminate: "/v1/terminate",
  sessions: "/v1/sessions",
};

function getAuthHeaders(connection: AgentConnection): HeadersInit {
  const headers: HeadersInit = {};

  if (connection.authentication) {
    for (const auth of connection.authentication) {
      if (auth.location === "header") {
        headers[auth.key] = auth.value;
      }
    }
  }

  return headers;
}

function buildAgentUrl(baseUrl: string, path: string, connection?: AgentConnection): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (connection?.authentication) {
    const queryAuths = connection.authentication
      .filter((a) => a.location === "query")
      .map((a) => `${encodeURIComponent(a.key)}=${encodeURIComponent(a.value)}`);

    if (queryAuths.length > 0) {
      return `${normalizedBase}${normalizedPath}?${queryAuths.join("&")}`;
    }
  }

  return `${normalizedBase}${normalizedPath}`;
}

export async function fetchAgentConfig(connection: AgentConnection): Promise<AgentsResponse> {
  const url = buildAgentUrl(connection.url, AGENT_API_PATHS.agentsJson, connection);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(connection),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  }
}

export async function healthCheck(connection: AgentConnection): Promise<HealthStatus> {
  const url = buildAgentUrl(connection.url, AGENT_API_PATHS.health, connection);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(connection),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Health check timeout");
    }
    throw error;
  }
}

export async function terminateProcess(connection: AgentConnection): Promise<void> {
  const url = buildAgentUrl(connection.url, AGENT_API_PATHS.terminate, connection);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(connection),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Terminate request timeout");
    }
    throw error;
  }
}

async function executeMcpTool(toolCall: ToolCall): Promise<{ success: boolean; result: unknown; error?: string }> {
  try {
    const { tool_name, arguments: args, server_name } = toolCall;
    
    let sessionId: string | undefined;
    const allConnections = mcpClient.getConnections();
    
    if (server_name) {
      const conn = allConnections.find((c) => c.serverUrl === server_name);
      if (conn) {
        const tools = mcpToolRegistry.getEnabledToolsByServer(conn.sessionId);
        const tool = tools.find((t) => t.name === tool_name);
        if (tool) {
          sessionId = conn.sessionId;
        }
      }
    }
    
    if (!sessionId) {
      for (const conn of allConnections) {
        const tools = mcpToolRegistry.getEnabledToolsByServer(conn.sessionId);
        const tool = tools.find((t) => t.name === tool_name);
        if (tool) {
          sessionId = conn.sessionId;
          break;
        }
      }
    }
    
    if (!sessionId) {
      return {
        success: false,
        result: null,
        error: `Tool "${tool_name}" not found in any connected MCP server`,
      };
    }
    
    const result = await mcpClient.callTool(sessionId, tool_name, args || {});
    
    if (result.ok) {
      return {
        success: true,
        result: result.data,
      };
    } else {
      return {
        success: false,
        result: null,
        error: result.error?.message || "Tool execution failed",
      };
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function* sendQuery(
  connection: AgentConnection,
  request: QueryRequest,
): AsyncGenerator<AgentEvent, void, unknown> {
  const url = buildAgentUrl(connection.url, AGENT_API_PATHS.query, connection);
  let currentRequest = { ...request };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    while (true) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...getAuthHeaders(connection),
        },
        body: JSON.stringify(currentRequest),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let hasToolCall = false;
      let pendingToolCall: ToolCall | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            if (!data || data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              console.debug("Agent response parsed:", parsed);

              if (parsed.tool_name || parsed.toolcall || parsed.type === "tool_call") {
                hasToolCall = true;
                const toolCall: ToolCall = {
                  tool_name: parsed.tool_name || parsed.toolcall?.tool_name || parsed.data?.tool_name || "unknown",
                  arguments: parsed.arguments || parsed.toolcall?.arguments || parsed.data?.arguments || {},
                  server_name: parsed.server_name || parsed.toolcall?.server_name || parsed.data?.server_name,
                };
                pendingToolCall = toolCall;
                console.debug("Received tool call:", toolCall);

                yield {
                  type: "tool_call",
                  data: toolCall,
                };
              } else if (parsed.event_type && parsed.message !== undefined) {
                const reasoningStep: ReasoningStep = {
                  event_type: parsed.event_type,
                  message: parsed.message,
                  details: parsed.details,
                };

                yield {
                  type: "reasoning_step",
                  data: reasoningStep,
                };
              } else if (parsed.eventType && parsed.message !== undefined) {
                console.debug("Found eventType format for reasoning");
                const reasoningStep: ReasoningStep = {
                  event_type: parsed.eventType,
                  message: parsed.message,
                  details: parsed.details,
                };

                yield {
                  type: "reasoning_step",
                  data: reasoningStep,
                };
              } else if (parsed.content !== undefined) {
                const messageChunk: MessageChunk = {
                  content: parsed.content,
                };

                yield {
                  type: "message_chunk",
                  data: messageChunk,
                };
              } else if (parsed.delta !== undefined) {
                console.debug("Found delta field, treating as message content");
                const messageChunk: MessageChunk = {
                  content: typeof parsed.delta === "string" ? parsed.delta : JSON.stringify(parsed.delta),
                };

                yield {
                  type: "message_chunk",
                  data: messageChunk,
                };
              } else if (parsed.type === "reasoning_step") {
                yield parsed as AgentEvent;
              } else if (parsed.type === "message_chunk") {
                yield parsed as AgentEvent;
              } else if (parsed.response !== undefined) {
                console.debug("Found response field, treating as message content");
                const messageChunk: MessageChunk = {
                  content: typeof parsed.response === "string" ? parsed.response : JSON.stringify(parsed.response),
                };

                yield {
                  type: "message_chunk",
                  data: messageChunk,
                };
              } else if (parsed.text !== undefined) {
                console.debug("Found text field, treating as message content");
                const messageChunk: MessageChunk = {
                  content: parsed.text,
                };

                yield {
                  type: "message_chunk",
                  data: messageChunk,
                };
              } else {
                console.warn("Unknown response format from agent:", parsed);
                const messageChunk: MessageChunk = {
                  content: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
                };

                yield {
                  type: "message_chunk",
                  data: messageChunk,
                };
              }
            } catch (e) {
              console.debug("Failed to parse JSON, treating as plain text:", data);
              if (data) {
                const messageChunk: MessageChunk = {
                  content: data,
                };

                yield {
                  type: "message_chunk",
                  data: messageChunk,
                };
              }
            }
          }
        }
      }

      if (hasToolCall && pendingToolCall) {
        console.debug("Executing MCP tool:", pendingToolCall);
        
        const toolResult = await executeMcpTool(pendingToolCall);
        
        yield {
          type: "tool_result",
          data: {
            tool_name: pendingToolCall.tool_name,
            result: toolResult.result,
            success: toolResult.success,
            error: toolResult.error,
          },
        };

        const toolResultMessage: QueryMessage = {
          role: "tool",
          content: JSON.stringify({
            tool_name: pendingToolCall.tool_name,
            result: toolResult.result,
            success: toolResult.success,
            error: toolResult.error,
          }),
          function: pendingToolCall.tool_name,
          data: toolResult.result,
        };

        currentRequest = {
          ...currentRequest,
          messages: [...currentRequest.messages, toolResultMessage],
        };
      } else {
        break;
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Query request timeout");
    }
    throw error;
  }
}

export async function checkAgentCapability(
  url: string,
  authentication?: Array<{ key: string; value: string; location: "header" | "query" }>,
): Promise<boolean> {
  const testUrl = buildAgentUrl(url, AGENT_API_PATHS.agentsJson, { url, authentication } as AgentConnection);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(testUrl, {
      method: "GET",
      headers: getAuthHeaders({ url, authentication } as AgentConnection),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

export async function getAvailableAgentConnections(): Promise<AgentConnection[]> {
  const connections = connectionService.getConnections();

  const connectedConns = connections.filter((conn) => conn.status === "connected");

  const results = await Promise.all(
    connectedConns.map(async (conn) => {
      const supportsAgents = await checkAgentCapability(conn.url, conn.authentication);
      if (!supportsAgents) {
        return null;
      }

      const result: AgentConnection = {
        id: conn.id,
        name: conn.name,
        url: conn.url,
        status: conn.status,
        agents: conn.metrics?.agents || 0,
        authentication: conn.authentication,
      };
      return result;
    }),
  );

  return results.filter((conn): conn is AgentConnection => conn !== null);
}

export async function refreshAgentConnection(connection: AgentConnection): Promise<AgentConnection> {
  try {
    const config = await fetchAgentConfig(connection);

    return {
      ...connection,
      agents: Object.keys(config).length,
    };
  } catch {
    return {
      ...connection,
      status: "error" as const,
    };
  }
}
