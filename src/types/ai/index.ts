export interface WidgetInfo {
  uuid: string;
  widget_id: string;
  name: string;
  description?: string;
  origin?: string;
  params?: Array<{
    name: string;
    current_value: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  function: string;
  input_arguments?: Record<string, unknown>;
  data?: unknown;
  extra_state?: Record<string, unknown>;
}

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
  isReasoning?: boolean;
  reasoningType?: "INFO" | "WARNING" | "ERROR";
  reasoningDetails?: Record<string, unknown>;
  metadata?: {
    type?: "text" | "markdown" | "chart" | "table";
    data?: unknown;
  };
}

export interface QueryMessage {
  role: "human" | "ai" | "tool";
  content: string;
  function?: string;
  data?: unknown;
}

export interface WidgetContext {
  primary: WidgetInfo[];
  secondary?: WidgetInfo[];
}

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverName: string;
}

export interface QueryRequest {
  messages: QueryMessage[];
  widgets?: WidgetContext;
  mcpTools?: McpToolInfo[];
}

export interface ReasoningStep {
  event_type: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface MessageChunk {
  content: string;
}

export interface ToolCall {
  tool_name: string;
  arguments: Record<string, unknown>;
  server_name?: string;
}

export interface ToolResultEvent {
  tool_name: string;
  result: unknown;
  success: boolean;
  error?: string;
}

export interface AgentEvent {
  type: "reasoning_step" | "message_chunk" | "tool_call" | "tool_result";
  data: ReasoningStep | MessageChunk | ToolCall | ToolResultEvent;
}

export interface AgentConfig {
  name: string;
  description: string;
  image?: string;
  endpoints: {
    query: string;
  };
  features?: {
    streaming?: boolean;
    "widget-dashboard-select"?: boolean;
    "widget-dashboard-search"?: boolean;
  };
}

export interface AgentsResponse {
  [agentId: string]: AgentConfig;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  dependencies?: {
    code_generator?: {
      type: string;
      available: boolean;
      message?: string;
    };
    target_repo?: {
      available: boolean;
      message?: string;
    };
  };
}

export interface Connection {
  id: string;
  name: string;
  url: string;
  status: "connected" | "disconnected" | "testing" | "error";
}

export interface AgentConnection extends Connection {
  agents?: number;
  authentication?: Array<{
    key: string;
    value: string;
    description?: string;
    location: "header" | "query";
  }>;
}

export interface UseAgentState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  selectedAgent: AgentConnection | null;
  availableAgents: AgentConnection[];
}

export interface UseAgentActions {
  sendMessage: (content: string, widgets?: WidgetInfo[]) => Promise<void>;
  clearMessages: () => void;
  selectAgent: (agent: AgentConnection) => void;
  terminateProcess: () => Promise<void>;
}

export interface UseAgentReturn extends UseAgentState, UseAgentActions {}
