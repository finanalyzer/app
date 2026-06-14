import type { WidgetInstance } from '../../types/widgets';
import { dashboardService } from './dashboardService';
import { workspaceNavigationService } from './workspaceNavigationService';

export interface WidgetGroup {
  primary: WidgetInstance[];
  secondary: WidgetInstance[];
  extra: WidgetInstance[];
}

export interface WorkspaceState {
  currentDashboardId: string | null;
  activeTabId: string | null;
  sidebarCollapsed: boolean;
}

export interface WorkspaceSnapshot {
  generated_at: number;
  workspace_state: {
    current_dashboard_id: string | null;
    active_tab_id: string | null;
    sidebar_collapsed: boolean;
  } | null;
  workspace_options: string[];
  dashboards: DashboardSnapshot[];
  dashboard_composition: Record<string, unknown> | null;
  widgets: {
    primary: WidgetInstance[];
    secondary: WidgetInstance[];
    extra: WidgetInstance[];
  };
  context: Array<{ key: string; value: unknown }>;
  artifacts: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
}

export interface DashboardSnapshot {
  id: string;
  name: string;
  description?: string;
  widgetCount: number;
  createdAt: number;
  updatedAt: number;
}

export class SnapshotGenerator {
  async generateSnapshot(): Promise<WorkspaceSnapshot> {
    const workspaceState = workspaceNavigationService.getWorkspaceState();
    const dashboards = await this.getDashboardSnapshots();
    const widgetGroups = await this.getWidgetGroups(dashboards);

    return {
      generated_at: Date.now(),
      workspace_state: {
        current_dashboard_id: workspaceState.currentDashboardId,
        active_tab_id: workspaceState.activeTabId,
        sidebar_collapsed: workspaceState.sidebarCollapsed,
      },
      workspace_options: [],
      dashboards,
      dashboard_composition: null,
      widgets: widgetGroups,
      context: [],
      artifacts: [],
      files: [],
      tools: [],
      skills: [],
    };
  }

  private async getDashboardSnapshots(): Promise<DashboardSnapshot[]> {
    const dashboards = await dashboardService.listDashboards();
    
    return dashboards.map((dashboard) => ({
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      widgetCount: dashboard.widgetCount,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt,
    }));
  }

  private async getWidgetGroups(dashboards: DashboardSnapshot[]): Promise<WidgetGroup> {
    const primary: WidgetInstance[] = [];
    const secondary: WidgetInstance[] = [];
    const extra: WidgetInstance[] = [];

    for (const dashboard of dashboards) {
      if (dashboard.id === workspaceNavigationService.getCurrentDashboardId()) {
        const widgets = await dashboardService.getDashboardWidgets(dashboard.id);
        widgets.forEach((widget, index) => {
          if (index < 4) {
            primary.push(widget);
          } else if (index < 8) {
            secondary.push(widget);
          } else {
            extra.push(widget);
          }
        });
      }
    }

    return { primary, secondary, extra };
  }

  async getDashboardSnapshot(dashboardId: string): Promise<DashboardSnapshot | undefined> {
    const dashboard = await dashboardService.getDashboardInfo(dashboardId);
    if (!dashboard) {
      return undefined;
    }

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      widgetCount: dashboard.widgetCount,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt,
    };
  }

  async getCurrentDashboardSnapshot(): Promise<DashboardSnapshot | undefined> {
    const currentId = workspaceNavigationService.getCurrentDashboardId();
    if (!currentId) {
      return undefined;
    }
    return this.getDashboardSnapshot(currentId);
  }

  async getWidgetSnapshot(widgetId: string): Promise<WidgetInstance | undefined> {
    const dashboards = await dashboardService.listDashboards();
    
    for (const dashboard of dashboards) {
      const widgets = await dashboardService.getDashboardWidgets(dashboard.id);
      const widget = widgets.find((w) => w.instanceId === widgetId);
      if (widget) {
        return widget;
      }
    }
    
    return undefined;
  }
}

export const snapshotGenerator = new SnapshotGenerator();