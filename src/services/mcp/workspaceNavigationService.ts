import type { DashboardInfo } from './dashboardService';
import { dashboardService } from './dashboardService';
import { navigationService } from './navigationService';

export interface WorkspaceState {
  currentDashboardId: string | null;
  dashboards: DashboardInfo[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
}

export interface NavigationEvent {
  type: 'dashboard_changed' | 'tab_changed' | 'sidebar_toggled';
  payload?: Record<string, unknown>;
}

export class WorkspaceNavigationService {
  private workspaceState: WorkspaceState = {
    currentDashboardId: null,
    dashboards: [],
    activeTabId: null,
    sidebarCollapsed: false,
  };

  private listeners: Set<(event: NavigationEvent) => void> = new Set();

  async initialize(): Promise<void> {
    this.workspaceState.dashboards = await dashboardService.listDashboards();
    if (this.workspaceState.dashboards.length > 0) {
      this.workspaceState.currentDashboardId = this.workspaceState.dashboards[0].id;
    }
    await navigationService.buildNavigation();
  }

  async navigateToDashboard(dashboardId: string): Promise<boolean> {
    const dashboard = await dashboardService.getDashboardInfo(dashboardId);
    if (!dashboard) {
      return false;
    }

    this.workspaceState.currentDashboardId = dashboardId;
    this.workspaceState.activeTabId = null;
    navigationService.setActivePath(`/dashboard/${dashboardId}`);

    this.notify({
      type: 'dashboard_changed',
      payload: { dashboardId },
    });

    return true;
  }

  async createAndNavigateToDashboard(name: string): Promise<string | null> {
    const dashboard = await dashboardService.createDashboard(name);
    await this.navigateToDashboard(dashboard.id);
    return dashboard.id;
  }

  async switchTab(tabId: string): Promise<void> {
    this.workspaceState.activeTabId = tabId;
    this.notify({
      type: 'tab_changed',
      payload: { tabId },
    });
  }

  toggleSidebar(): void {
    this.workspaceState.sidebarCollapsed = !this.workspaceState.sidebarCollapsed;
    this.notify({
      type: 'sidebar_toggled',
      payload: { collapsed: this.workspaceState.sidebarCollapsed },
    });
  }

  getWorkspaceState(): WorkspaceState {
    return { ...this.workspaceState };
  }

  getCurrentDashboardId(): string | null {
    return this.workspaceState.currentDashboardId;
  }

  getActiveTabId(): string | null {
    return this.workspaceState.activeTabId;
  }

  isSidebarCollapsed(): boolean {
    return this.workspaceState.sidebarCollapsed;
  }

  async refreshDashboards(): Promise<void> {
    this.workspaceState.dashboards = await dashboardService.listDashboards();
    await navigationService.updateNavigation();
  }

  subscribe(listener: (event: NavigationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event: NavigationEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

export const workspaceNavigationService = new WorkspaceNavigationService();