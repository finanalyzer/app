import type { WidgetConfig, WidgetParameter } from '../../types/widgets';

export interface WidgetSchema {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  parameters: WidgetParameter[];
  defaults?: Record<string, unknown>;
}

export class WidgetSchemaService {
  private availableWidgets: WidgetConfig[] = [];

  registerWidget(config: WidgetConfig): void {
    const existingIndex = this.availableWidgets.findIndex((w) => w.id === config.id);
    if (existingIndex >= 0) {
      this.availableWidgets[existingIndex] = config;
    } else {
      this.availableWidgets.push(config);
    }
  }

  listAvailableWidgets(origin?: string): WidgetConfig[] {
    if (!origin) {
      return [...this.availableWidgets];
    }
    return this.availableWidgets.filter((w) => w.source === origin);
  }

  getWidgetSchema(widgetId: string): WidgetSchema | undefined {
    const widget = this.availableWidgets.find((w) => w.id === widgetId);
    if (!widget) {
      return undefined;
    }

    const defaults: Record<string, unknown> = {};
    widget.params.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    });

    return {
      id: widget.id,
      name: widget.name,
      description: widget.description,
      type: widget.type,
      category: widget.category,
      parameters: widget.params,
      defaults,
    };
  }

  getWidgetSchemas(): WidgetSchema[] {
    return this.availableWidgets.map((widget) => {
      const defaults: Record<string, unknown> = {};
      widget.params.forEach((param) => {
        if (param.default !== undefined) {
          defaults[param.name] = param.default;
        }
      });

      return {
        id: widget.id,
        name: widget.name,
        description: widget.description,
        type: widget.type,
        category: widget.category,
        parameters: widget.params,
        defaults,
      };
    });
  }

  getCategories(): string[] {
    const categories = new Set(this.availableWidgets.map((w) => w.category));
    return Array.from(categories);
  }

  getWidgetsByCategory(category: string): WidgetConfig[] {
    return this.availableWidgets.filter((w) => w.category === category);
  }

  clear(): void {
    this.availableWidgets = [];
  }

  getWidgetCount(): number {
    return this.availableWidgets.length;
  }
}

export const widgetSchemaService = new WidgetSchemaService();