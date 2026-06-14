import type { WidgetInstance } from '../../types/widgets';
import {
  getDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
} from '../dashboardApi';
import { widgetCRUDService } from './widgetCRUDService';

export interface DashboardInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  tabIds?: string[];
  widgetCount: number;
}

export interface TabInfo {
  id: string;
  name: string;
  icon?: string;
}

export class DashboardService {
  async listDashboards(): Promise<DashboardInfo[]> {
    const dashboards = await getDashboards();

    return dashboards.map((dashboard) => ({
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      createdAt: dashboard.created_at ? new Date(dashboard.created_at).getTime() : 0,
      updatedAt: dashboard.updated_at ? new Date(dashboard.updated_at).getTime() : 0,
      tabIds: dashboard.tabs?.map((tab: { id: string }) => tab.id),
      widgetCount: dashboard.widgets?.length || 0,
    }));
  }

  async getDashboardInfo(dashboardId: string): Promise<DashboardInfo | undefined> {
    try {
      const dashboard = await getDashboard(dashboardId);

      return {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        createdAt: dashboard.created_at ? new Date(dashboard.created_at).getTime() : 0,
        updatedAt: dashboard.updated_at ? new Date(dashboard.updated_at).getTime() : 0,
        tabIds: dashboard.tabs?.map((tab: { id: string }) => tab.id),
        widgetCount: dashboard.widgets?.length || 0,
      };
    } catch {
      return undefined;
    }
  }

  async createDashboard(name: string, description?: string): Promise<DashboardInfo> {
    const dashboard = await createDashboard({
      id: `dashboard-${Date.now()}`,
      name,
      description: description || '',
      widgets: [],
      tabs: [],
    });

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      createdAt: dashboard.created_at ? new Date(dashboard.created_at).getTime() : 0,
      updatedAt: dashboard.updated_at ? new Date(dashboard.updated_at).getTime() : 0,
      tabIds: [],
      widgetCount: 0,
    };
  }

  async updateDashboard(
    dashboardId: string,
    updates: Record<string, unknown>,
  ): Promise<DashboardInfo | undefined> {
    const updateData: Partial<{ name: string; description: string }> = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name as string;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description as string;
    }

    const dashboard = await updateDashboard(dashboardId, updateData);

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      createdAt: dashboard.created_at ? new Date(dashboard.created_at).getTime() : 0,
      updatedAt: dashboard.updated_at ? new Date(dashboard.updated_at).getTime() : 0,
      tabIds: dashboard.tabs?.map((tab: { id: string }) => tab.id) || [],
      widgetCount: dashboard.widgets?.length || 0,
    };
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    await deleteDashboard(dashboardId);
  }

  async getDashboardWidgets(dashboardId: string): Promise<WidgetInstance[]> {
    const dashboard = await getDashboard(dashboardId);
    const widgets: WidgetInstance[] = [];

    for (const widget of dashboard.widgets) {
      const widgetInstance = await widgetCRUDService.readWidget(dashboardId, widget.id);
      if (widgetInstance) {
        widgets.push(widgetInstance);
      }
    }

    return widgets;
  }

  async addTab(dashboardId: string, tabName: string, icon?: string): Promise<TabInfo> {
    const dashboard = await getDashboard(dashboardId);
    const newTab: TabInfo = {
      id: `tab-${Date.now()}`,
      name: tabName,
      icon,
    };

    const tabs = dashboard.tabs || [];
    tabs.push(newTab);

    await updateDashboard(dashboardId, { tabs });

    return newTab;
  }

  async removeTab(dashboardId: string, tabId: string): Promise<void> {
    const dashboard = await getDashboard(dashboardId);
    const tabs = (dashboard.tabs || []).filter((tab: { id: string }) => tab.id !== tabId);

    await updateDashboard(dashboardId, { tabs });
  }

  async renameTab(dashboardId: string, tabId: string, newName: string): Promise<TabInfo | undefined> {
    const dashboard = await getDashboard(dashboardId);
    const tabs = dashboard.tabs || [];
    const tab = tabs.find((t: { id: string }) => t.id === tabId);
    if (!tab) return undefined;

    tab.name = newName;
    await updateDashboard(dashboardId, { tabs });
    return tab;
  }
}

export const dashboardService = new DashboardService();