import type { McpTool, McpServerConnection } from './mcpClient';

export interface ToolRegistryEntry {
  serverName: string;
  serverUrl: string;
  tools: McpTool[];
  enabled: boolean;
}

export class McpToolRegistry {
  private registry: Map<string, ToolRegistryEntry> = new Map();

  registerServer(connection: McpServerConnection, tools: McpTool[]): void {
    const entry: ToolRegistryEntry = {
      serverName: connection.serverUrl,
      serverUrl: connection.serverUrl,
      tools,
      enabled: true,
    };
    this.registry.set(connection.sessionId, entry);
  }

  unregisterServer(sessionId: string): void {
    this.registry.delete(sessionId);
  }

  enableServer(sessionId: string): void {
    const entry = this.registry.get(sessionId);
    if (entry) {
      entry.enabled = true;
      entry.tools.forEach((tool) => {
        tool.enabled = true;
      });
    }
  }

  disableServer(sessionId: string): void {
    const entry = this.registry.get(sessionId);
    if (entry) {
      entry.enabled = false;
      entry.tools.forEach((tool) => {
        tool.enabled = false;
      });
    }
  }

  enableTool(sessionId: string, toolName: string): void {
    const entry = this.registry.get(sessionId);
    if (entry) {
      const tool = entry.tools.find((t) => t.name === toolName);
      if (tool) {
        tool.enabled = true;
      }
    }
  }

  disableTool(sessionId: string, toolName: string): void {
    const entry = this.registry.get(sessionId);
    if (entry) {
      const tool = entry.tools.find((t) => t.name === toolName);
      if (tool) {
        tool.enabled = false;
      }
    }
  }

  getToolsByServer(sessionId: string): McpTool[] {
    const entry = this.registry.get(sessionId);
    return entry?.tools || [];
  }

  getEnabledToolsByServer(sessionId: string): McpTool[] {
    const entry = this.registry.get(sessionId);
    return entry?.tools.filter((t) => t.enabled) || [];
  }

  getAllTools(): McpTool[] {
    const allTools: McpTool[] = [];
    this.registry.forEach((entry) => {
      allTools.push(...entry.tools);
    });
    return allTools;
  }

  getAllEnabledTools(): McpTool[] {
    const enabledTools: McpTool[] = [];
    this.registry.forEach((entry) => {
      if (entry.enabled) {
        enabledTools.push(...entry.tools.filter((t) => t.enabled));
      }
    });
    return enabledTools;
  }

  getServers(): ToolRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  getServer(sessionId: string): ToolRegistryEntry | undefined {
    return this.registry.get(sessionId);
  }

  hasServer(sessionId: string): boolean {
    return this.registry.has(sessionId);
  }

  getTool(sessionId: string, toolName: string): McpTool | undefined {
    const entry = this.registry.get(sessionId);
    return entry?.tools.find((t) => t.name === toolName);
  }

  clear(): void {
    this.registry.clear();
  }
}

export const mcpToolRegistry = new McpToolRegistry();
