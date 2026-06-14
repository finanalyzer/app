import type { McpTool } from './mcpClient';
import type { WidgetConfig, WidgetInstance, WidgetParameter } from '../../types/widgets';
import { mcpToolRegistry } from './mcpToolRegistry';
import { addWidget } from '../dashboardApi';

export interface WidgetToolMatch {
  widget: WidgetConfig;
  tool: McpTool;
  serverName: string;
}

export interface ToolWidgetReference {
  widgetId: string;
  widgetName: string;
  serverName: string;
  toolName: string;
}

export class WidgetToolMapping {
  findMatchingWidgets(toolName: string, serverName?: string): WidgetToolMatch[] {
    const matches: WidgetToolMatch[] = [];
    
    const allTools = serverName
      ? mcpToolRegistry.getEnabledToolsByServer(serverName)
      : mcpToolRegistry.getAllEnabledTools();

    const targetTool = allTools.find(
      (tool) => tool.name === toolName && (!serverName || tool.serverName === serverName)
    );

    if (!targetTool) {
      return matches;
    }

    const availableWidgets = this.getAvailableWidgets();
    
    for (const widget of availableWidgets) {
      if (widget.mcpToolMatch) {
        const matchesServer = !widget.mcpToolMatch.serverName || 
          widget.mcpToolMatch.serverName === targetTool.serverName;
        const matchesTool = widget.mcpToolMatch.toolName === targetTool.name;
        
        if (matchesServer && matchesTool) {
          matches.push({
            widget,
            tool: targetTool,
            serverName: targetTool.serverName,
          });
        }
      }
    }

    return matches;
  }

  findMatchingTools(widgetId: string): McpTool[] {
    const widgets = this.getAvailableWidgets();
    const widget = widgets.find((w) => w.id === widgetId);
    
    if (!widget?.mcpToolMatch) {
      return [];
    }

    const { serverName, toolName } = widget.mcpToolMatch;
    
    return mcpToolRegistry.getAllEnabledTools().filter((tool) => {
      const matchesServer = !serverName || tool.serverName === serverName;
      const matchesTool = tool.name === toolName;
      return matchesServer && matchesTool;
    });
  }

  createToolWidgetReference(toolCall: { tool_name: string; server_name?: string }): ToolWidgetReference | null {
    const matches = this.findMatchingWidgets(toolCall.tool_name, toolCall.server_name);
    
    if (matches.length === 0) {
      return null;
    }

    const bestMatch = matches[0];
    return {
      widgetId: bestMatch.widget.id,
      widgetName: bestMatch.widget.name,
      serverName: bestMatch.serverName,
      toolName: bestMatch.tool.name,
    };
  }

  generateWidgetInfoFromTool(
    tool: McpTool,
    inputParams?: Record<string, unknown>
  ): WidgetConfig {
    const params: WidgetParameter[] = [];
    
    if (tool.inputSchema) {
      for (const [key, value] of Object.entries(tool.inputSchema)) {
        const schema = value as Record<string, unknown>;
        const paramType = this.mapSchemaTypeToWidgetType(schema.type as string);
        
        params.push({
          name: key,
          type: paramType,
          label: (schema.title as string) || key,
          description: schema.description as string,
          default: inputParams?.[key] ?? schema.default,
          required: schema.required === true,
        });
      }
    }

    const widgetId = `${tool.serverName}/${tool.name}`;
    
    return {
      id: widgetId,
      name: tool.description || tool.name,
      description: tool.description || '',
      type: 'mcp-tool-result',
      category: 'MCP',
      subcategory: 'Tools',
      endpoint: '',
      gridData: {
        w: 4,
        h: 3,
      },
      params,
      source: tool.serverName,
      mcpToolMatch: {
        serverName: tool.serverName,
        toolName: tool.name,
      },
    };
  }

  async addWidgetFromToolResult(
    toolName: string,
    serverName: string,
    inputParams: Record<string, unknown>,
    resultData: unknown,
    dashboardId: string
  ): Promise<WidgetInstance | null> {
    const tools = mcpToolRegistry.getAllEnabledTools();
    const tool = tools.find(
      (t) => t.name === toolName && t.serverName === serverName
    );

    if (!tool) {
      return null;
    }

    const widgetConfig = this.generateWidgetInfoFromTool(tool, inputParams);
    
    const widgetData = {
      id: `${toolName}-${Date.now()}`,
      type: widgetConfig.type,
      title: widgetConfig.name,
      position: { x: 0, y: 0 },
      data: {
        toolResult: resultData,
        inputParams,
        mcpToolMatch: widgetConfig.mcpToolMatch,
      },
    };

    try {
      const created = await addWidget(dashboardId, widgetData);
      
      return {
        ...widgetConfig,
        instanceId: created.id,
        dashboardId,
        position: { x: 0, y: 0 },
        currentParams: inputParams,
        data: {
          toolResult: resultData,
          inputParams,
        },
      };
    } catch {
      return null;
    }
  }

  markToolCallInReasoning(
    reasoningText: string,
    toolCall: { tool_name: string; server_name?: string }
  ): string {
    const reference = this.createToolWidgetReference(toolCall);
    
    if (!reference) {
      return reasoningText;
    }

    const marker = `[Widget: ${reference.widgetName}]`;
    
    if (reasoningText.includes(toolCall.tool_name)) {
      return reasoningText.replace(
        new RegExp(`\\b${toolCall.tool_name}\\b`, 'g'),
        `${toolCall.tool_name} ${marker}`
      );
    }

    return `${reasoningText} ${marker}`;
  }

  private getAvailableWidgets(): WidgetConfig[] {
    return [];
  }

  private mapSchemaTypeToWidgetType(schemaType: string): WidgetParameter['type'] {
    switch (schemaType.toLowerCase()) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'select';
      case 'object':
        return 'form';
      default:
        return 'string';
    }
  }
}

export const widgetToolMapping = new WidgetToolMapping();