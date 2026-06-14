import type { WidgetInstance } from '../../types/widgets';
import { widgetCRUDService } from './widgetCRUDService';

export type GenerativeWidgetType = 'note' | 'table' | 'chart' | 'html';

export interface GenerativeWidgetData {
  type: GenerativeWidgetType;
  content?: string;
  data?: unknown[];
  columns?: string[];
  chartConfig?: Record<string, unknown>;
}

export class GenerativeWidgetService {
  async createNoteWidget(
    dashboardId: string,
    content: string,
  ): Promise<WidgetInstance> {
    const widgetData = {
      id: `note-${Date.now()}`,
      type: 'rich_note',
      name: 'Note',
      description: 'A rich text note widget',
      category: 'Generative',
      subcategory: 'Notes',
      endpoint: '',
      gridData: { w: 6, h: 4 },
      params: [],
      source: 'generative',
      data: { content },
    };

    return widgetCRUDService.createWidget(dashboardId, widgetData);
  }

  async createTableWidget(
    dashboardId: string,
    data: unknown[],
    columns?: string[],
  ): Promise<WidgetInstance> {
    const widgetData = {
      id: `table-${Date.now()}`,
      type: 'table',
      name: 'Data Table',
      description: 'A data table widget',
      category: 'Generative',
      subcategory: 'Tables',
      endpoint: '',
      gridData: { w: 8, h: 6 },
      params: [],
      source: 'generative',
      data: {
        rows: data,
        columns: columns || this.extractColumns(data),
      },
    };

    return widgetCRUDService.createWidget(dashboardId, widgetData);
  }

  async createChartWidget(
    dashboardId: string,
    chartType: string,
    data: unknown[],
    config?: Record<string, unknown>,
  ): Promise<WidgetInstance> {
    const widgetData = {
      id: `chart-${Date.now()}`,
      type: 'chart',
      name: 'Chart',
      description: 'A chart widget',
      category: 'Generative',
      subcategory: 'Charts',
      endpoint: '',
      gridData: { w: 8, h: 6 },
      params: [],
      source: 'generative',
      data: {
        chartType,
        data,
        config: config || {},
      },
    };

    return widgetCRUDService.createWidget(dashboardId, widgetData);
  }

  async createHtmlWidget(
    dashboardId: string,
    htmlContent: string,
  ): Promise<WidgetInstance> {
    const widgetData = {
      id: `html-${Date.now()}`,
      type: 'html',
      name: 'HTML Widget',
      description: 'An HTML content widget',
      category: 'Generative',
      subcategory: 'HTML',
      endpoint: '',
      gridData: { w: 8, h: 6 },
      params: [],
      source: 'generative',
      data: { content: htmlContent },
    };

    return widgetCRUDService.createWidget(dashboardId, widgetData);
  }

  async addGenerativeWidget(
    dashboardId: string,
    widgetData: GenerativeWidgetData,
  ): Promise<WidgetInstance> {
    switch (widgetData.type) {
      case 'note':
        return this.createNoteWidget(dashboardId, widgetData.content || '');
      case 'table':
        return this.createTableWidget(dashboardId, widgetData.data || [], widgetData.columns);
      case 'chart':
        return this.createChartWidget(dashboardId, 'line', widgetData.data || [], widgetData.chartConfig);
      case 'html':
        return this.createHtmlWidget(dashboardId, widgetData.content || '');
      default:
        throw new Error(`Unsupported widget type: ${widgetData.type}`);
    }
  }

  private extractColumns(data: unknown[]): string[] {
    if (data.length === 0) {
      return [];
    }

    const firstRow = data[0] as Record<string, unknown>;
    return Object.keys(firstRow || {});
  }

  getSupportedTypes(): GenerativeWidgetType[] {
    return ['note', 'table', 'chart', 'html'];
  }
}

export const generativeWidgetService = new GenerativeWidgetService();