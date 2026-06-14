import type { WidgetInstance } from '../../types/widgets';
import { addWidget, updateWidget, deleteWidget, getDashboard } from '../dashboardApi';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  tabId?: string;
}

export class WidgetCRUDService {
  async createWidget(dashboardId: string, widgetData: Record<string, unknown>): Promise<WidgetInstance> {
    const widget = await addWidget(dashboardId, {
      id: widgetData.id as string || `widget-${Date.now()}`,
      type: widgetData.type as string || 'generic',
      title: widgetData.name as string || 'Untitled Widget',
      position: widgetData.position as Record<string, unknown> || { x: 0, y: 0 },
      data: widgetData,
    });

    return {
      ...widgetData,
      instanceId: widget.id,
      dashboardId,
      position: { x: 0, y: 0 },
      currentParams: widgetData.params as Record<string, unknown> || {},
    } as unknown as WidgetInstance;
  }

  async readWidget(dashboardId: string, widgetId: string): Promise<WidgetInstance | undefined> {
    try {
      const dashboard = await getDashboard(dashboardId);
      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      
      if (!widget) {
        return undefined;
      }

      return {
        id: widget.id,
        instanceId: widget.id,
        dashboardId,
        type: widget.type,
        name: widget.title,
        description: '',
        category: '',
        subcategory: '',
        endpoint: '',
        gridData: { w: 4, h: 3 },
        params: [],
        source: 'openbb',
        position: widget.position as { x: number; y: number } || { x: 0, y: 0 },
        currentParams: widget.data as Record<string, unknown> || {},
        data: widget.data,
      };
    } catch {
      return undefined;
    }
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Record<string, unknown>,
  ): Promise<WidgetInstance | undefined> {
    const updateData: Partial<{ id: string; type: string; title: string; position: Record<string, unknown>; data: Record<string, unknown> }> = {};

    if (updates.name !== undefined) {
      updateData.title = updates.name as string;
    }
    if (updates.type !== undefined) {
      updateData.type = updates.type as string;
    }
    if (updates.position !== undefined) {
      updateData.position = updates.position as Record<string, unknown>;
    }
    if (updates.data !== undefined) {
      updateData.data = updates.data as Record<string, unknown>;
    }

    const widget = await updateWidget(dashboardId, widgetId, updateData);

    return {
      ...widget,
      instanceId: widget.id,
      dashboardId,
      name: widget.title,
      position: widget.position as { x: number; y: number } || { x: 0, y: 0 },
      currentParams: widget.data as Record<string, unknown> || {},
    } as unknown as WidgetInstance;
  }

  async deleteWidget(dashboardId: string, widgetId: string): Promise<void> {
    await deleteWidget(dashboardId, widgetId);
  }

  async updateWidgetLayout(
    dashboardId: string,
    widgetId: string,
    layout: Record<string, unknown>,
  ): Promise<WidgetLayout> {
    await updateWidget(dashboardId, widgetId, {
      position: {
        x: layout.x as number,
        y: layout.y as number,
        w: layout.w as number,
        h: layout.h as number,
      },
    });

    return {
      x: layout.x as number || 0,
      y: layout.y as number || 0,
      w: layout.w as number || 4,
      h: layout.h as number || 3,
      tabId: layout.tabId as string,
    };
  }

  async moveWidgetToTab(
    dashboardId: string,
    widgetId: string,
    tabId: string,
  ): Promise<void> {
    await updateWidget(dashboardId, widgetId, {
      data: { tabId },
    });
  }
}

export const widgetCRUDService = new WidgetCRUDService();