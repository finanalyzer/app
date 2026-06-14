import type { WidgetInstance } from '../../types/widgets';
import { widgetCRUDService } from './widgetCRUDService';

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutUpdate {
  widgetId: string;
  position: GridPosition;
  tabId?: string;
}

export class WidgetLayoutService {
  private gridWidth = 40;

  async updateWidgetPosition(
    dashboardId: string,
    widgetId: string,
    position: GridPosition,
  ): Promise<GridPosition> {
    await widgetCRUDService.updateWidget(dashboardId, widgetId, {
      position: {
        x: position.x,
        y: position.y,
      },
    });

    return position;
  }

  async resizeWidget(
    dashboardId: string,
    widgetId: string,
    width: number,
    height: number,
  ): Promise<GridPosition> {
    const widget = await widgetCRUDService.readWidget(dashboardId, widgetId);
    if (!widget) {
      throw new Error('Widget not found');
    }

    const newPosition: GridPosition = {
      x: widget.position.x,
      y: widget.position.y,
      w: Math.min(Math.max(width, 1), this.gridWidth),
      h: Math.max(height, 1),
    };

    await widgetCRUDService.updateWidget(dashboardId, widgetId, {
      position: {
        x: newPosition.x,
        y: newPosition.y,
        w: newPosition.w,
        h: newPosition.h,
      },
    });

    return newPosition;
  }

  async moveWidgetToTab(
    dashboardId: string,
    widgetId: string,
    targetTabId: string,
  ): Promise<void> {
    await widgetCRUDService.moveWidgetToTab(dashboardId, widgetId, targetTabId);
  }

  async batchUpdateLayout(
    dashboardId: string,
    updates: LayoutUpdate[],
  ): Promise<void> {
    for (const update of updates) {
      await widgetCRUDService.updateWidget(dashboardId, update.widgetId, {
        position: {
          x: update.position.x,
          y: update.position.y,
          w: update.position.w,
          h: update.position.h,
        },
      });

      if (update.tabId) {
        await widgetCRUDService.moveWidgetToTab(dashboardId, update.widgetId, update.tabId);
      }
    }
  }

  autoArrangeWidgets(_dashboardId: string, widgets: WidgetInstance[]): Promise<LayoutUpdate[]> {
    const updates: LayoutUpdate[] = [];
    let currentY = 0;

    widgets.forEach((widget, index) => {
      const rowPosition = index % 3;
      const rowHeight = Math.max(widget.gridData?.h || 3, 3);

      if (rowPosition === 0) {
        currentY += rowHeight;
      }

      updates.push({
        widgetId: widget.instanceId,
        position: {
          x: rowPosition * 14,
          y: currentY - rowHeight,
          w: widget.gridData?.w || 14,
          h: widget.gridData?.h || 3,
        },
      });
    });

    return Promise.resolve(updates);
  }

  getGridWidth(): number {
    return this.gridWidth;
  }

  setGridWidth(width: number): void {
    this.gridWidth = Math.max(width, 1);
  }
}

export const widgetLayoutService = new WidgetLayoutService();