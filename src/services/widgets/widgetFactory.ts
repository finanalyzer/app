import { HtmlWidget } from "../../components/widgets/HtmlWidget";
import { MarkdownWidget } from "../../components/widgets/MarkdownWidget";
import { NoteWidget } from "../../components/widgets/shared/NoteWidget";
import DebugWidget from "../../components/widgets/DebugWidget";
import { TableWidget } from "../../components/widgets/shared/TableWidget";
import { ChartWidget } from "../../components/widgets/shared/ChartWidget";
import { MetricWidget } from "../../components/widgets/shared/MetricWidget";

import type { WidgetConfig, WidgetTypeDefinition } from "../../types/widgets";
import { BaseWidget } from "../../types/widgets";

// Widget factory class
export class WidgetFactory {
  private static widgetTypes: Map<string, WidgetTypeDefinition> = new Map();

  // Register a widget type
  static registerWidgetType(typeDef: WidgetTypeDefinition): void {
    this.widgetTypes.set(typeDef.type, typeDef);
  }

  // Get all registered widget types
  static getWidgetTypes(): WidgetTypeDefinition[] {
    return Array.from(this.widgetTypes.values());
  }

  // Get a widget type by type
  static getWidgetType(type: string): WidgetTypeDefinition | undefined {
    return this.widgetTypes.get(type);
  }

  // Create a widget instance
  static createWidget(
    config: WidgetConfig,
    instanceId: string,
    params?: Record<string, unknown>,
  ): BaseWidget {
    // For now, we'll return a base widget implementation
    // In a real implementation, we would create a specific widget class based on the type
    return new GenericWidget(config, instanceId, params);
  }
}

// Generic widget implementation
class GenericWidget extends BaseWidget {
  async fetchData(): Promise<any> {
    try {
      const params = this.getParams();
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const url = `${this.config.endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch widget data: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        data,
        timestamp: new Date().toISOString(),
        widgetId: this.config.id,
        instanceId: this.instanceId,
      };
    } catch (error) {
      console.error("Error fetching widget data:", error);
      throw error;
    }
  }

  validateParams(params: Record<string, unknown>): boolean {
    // Basic validation - check required parameters
    const requiredParams = this.config.params.filter((p) => p.required);

    for (const param of requiredParams) {
      if (params[param.name] === undefined || params[param.name] === null) {
        return false;
      }
    }

    return true;
  }
}

// Markdown widget implementation
class MarkdownWidgetImpl extends BaseWidget {
  async fetchData(): Promise<any> {
    try {
      const params = this.getParams();
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const url = `${this.config.endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch markdown content: ${response.statusText}`,
        );
      }

      const content = await response.text();

      return {
        content,
        timestamp: new Date().toISOString(),
        widgetId: this.config.id,
        instanceId: this.instanceId,
      };
    } catch (error) {
      console.error("Error fetching markdown content:", error);
      throw error;
    }
  }

  validateParams(params: Record<string, unknown>): boolean {
    const requiredParams = this.config.params.filter((p) => p.required);
    for (const param of requiredParams) {
      if (params[param.name] === undefined || params[param.name] === null) {
        return false;
      }
    }
    return true;
  }
}

// HTML widget implementation
class HtmlWidgetImpl extends BaseWidget {
  async fetchData(): Promise<any> {
    try {
      const params = this.getParams();
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const url = `${this.config.endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch HTML content: ${response.statusText}`);
      }

      const content = await response.text();

      return {
        content,
        timestamp: new Date().toISOString(),
        widgetId: this.config.id,
        instanceId: this.instanceId,
      };
    } catch (error) {
      console.error("Error fetching HTML content:", error);
      throw error;
    }
  }

  validateParams(params: Record<string, unknown>): boolean {
    const requiredParams = this.config.params.filter((p) => p.required);
    for (const param of requiredParams) {
      if (params[param.name] === undefined || params[param.name] === null) {
        return false;
      }
    }
    return true;
  }
}

// Debug widget implementation
class DebugWidgetImpl extends BaseWidget {
  async fetchData(): Promise<any> {
    try {
      const params = this.getParams();
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const url = `${this.config.endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch widget data: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        data,
        timestamp: new Date().toISOString(),
        widgetId: this.config.id,
        instanceId: this.instanceId,
      };
    } catch (error) {
      console.error("Error fetching debug widget data:", error);
      throw error;
    }
  }

  validateParams(params: Record<string, unknown>): boolean {
    const requiredParams = this.config.params.filter((p) => p.required);
    for (const param of requiredParams) {
      if (params[param.name] === undefined || params[param.name] === null) {
        return false;
      }
    }
    return true;
  }
}

// Override createWidget method to use specific widget classes
WidgetFactory.createWidget = function (
  config: WidgetConfig,
  instanceId: string,
  params?: Record<string, unknown>,
): BaseWidget {
  switch (config.type) {
    case "markdown":
      return new MarkdownWidgetImpl(config, instanceId, params);
    case "html":
      return new HtmlWidgetImpl(config, instanceId, params);
    case "debug":
      return new DebugWidgetImpl(config, instanceId, params);
    default:
      return new GenericWidget(config, instanceId, params);
  }
};

// Example widget type registration
WidgetFactory.registerWidgetType({
  type: "chart",
  displayName: "Chart",
  description: "A widget that displays data as a chart",
  defaultGridData: { w: 4, h: 3 },
  supportedParameters: [
    {
      name: "chartType",
      type: "select",
      label: "Chart Type",
      default: "line",
      options: [
        { value: "line", label: "Line" },
        { value: "bar", label: "Bar" },
        { value: "pie", label: "Pie" },
      ],
    },
    {
      name: "timeRange",
      type: "select",
      label: "Time Range",
      default: "1d",
      options: [
        { value: "1d", label: "1 Day" },
        { value: "1w", label: "1 Week" },
        { value: "1m", label: "1 Month" },
        { value: "3m", label: "3 Months" },
        { value: "1y", label: "1 Year" },
      ],
    },
  ],
  renderer: ChartWidget,
  modeConfig: {
    debug: {
      enabled: true,
      showDebugInfo: true,
      default: true,
    },
    production: {
      enabled: true,
      optimizePerformance: true,
    },
  },
});

WidgetFactory.registerWidgetType({
  type: "table",
  displayName: "Table",
  description: "A widget that displays data as a table",
  defaultGridData: { w: 4, h: 4 },
  supportedParameters: [
    {
      name: "columns",
      type: "string",
      label: "Columns",
      default: "symbol,name,price,change",
    },
    {
      name: "sortBy",
      type: "string",
      label: "Sort By",
      default: "symbol",
    },
    {
      name: "sortDirection",
      type: "select",
      label: "Sort Direction",
      default: "asc",
      options: [
        { value: "asc", label: "Ascending" },
        { value: "desc", label: "Descending" },
      ],
    },
  ],
  renderer: TableWidget,
  modeConfig: {
    debug: {
      enabled: true,
      showDebugInfo: true,
      default: true,
    },
    production: {
      enabled: true,
      optimizePerformance: true,
    },
  },
});

WidgetFactory.registerWidgetType({
  type: "metric",
  displayName: "Metric",
  description: "A widget that displays a single metric",
  defaultGridData: { w: 2, h: 2 },
  supportedParameters: [
    {
      name: "metric",
      type: "string",
      label: "Metric",
      required: true,
    },
    {
      name: "title",
      type: "string",
      label: "Title",
    },
    {
      name: "color",
      type: "color",
      label: "Color",
      default: "#3b82f6",
    },
  ],
  renderer: MetricWidget,
});

// Register Markdown widget type
WidgetFactory.registerWidgetType({
  type: "markdown",
  displayName: "Markdown",
  description: "A widget that displays Markdown content",
  defaultGridData: { w: 4, h: 3 },
  supportedParameters: [
    {
      name: "content",
      type: "string",
      label: "Content",
      default: "# Markdown Widget\n\nThis is a Markdown widget.",
    },
  ],
  renderer: MarkdownWidget,
});

// Register HTML widget type
WidgetFactory.registerWidgetType({
  type: "html",
  displayName: "HTML",
  description: "A widget that displays HTML content with JavaScript execution",
  defaultGridData: { w: 4, h: 3 },
  supportedParameters: [
    {
      name: "content",
      type: "string",
      label: "Content",
      default: "<div>HTML Widget</div>",
    },
  ],
  renderer: HtmlWidget,
});

// Register Note widget type
WidgetFactory.registerWidgetType({
  type: "note",
  displayName: "Note",
  description: "A widget that displays rich note content with structured formatting",
  defaultGridData: { w: 6, h: 5 },
  supportedParameters: [
    {
      name: "title",
      type: "string",
      label: "Title",
      default: "Note",
    },
  ],
  renderer: NoteWidget,
});

// Register Debug widget type
WidgetFactory.registerWidgetType({
  type: "debug",
  displayName: "Debug",
  description: "Developer debugging tool for widget simulation",
  defaultGridData: { w: 6, h: 4 },
  supportedParameters: [],
  renderer: DebugWidget,
});


