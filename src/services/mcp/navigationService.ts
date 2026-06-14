import { dashboardService } from './dashboardService';

export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  path: string;
  type: 'dashboard' | 'page' | 'external';
  target?: string;
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
  collapsed?: boolean;
}

export interface NavigationState {
  sections: NavigationSection[];
  activePath: string;
}

export class NavigationService {
  private navigationState: NavigationState = {
    sections: [],
    activePath: '/',
  };

  async buildNavigation(): Promise<NavigationSection[]> {
    const dashboards = await dashboardService.listDashboards();

    const dashboardItems: NavigationItem[] = dashboards.map((dashboard) => ({
      id: `dashboard-${dashboard.id}`,
      label: dashboard.name,
      icon: 'layout-dashboard',
      path: `/dashboard/${dashboard.id}`,
      type: 'dashboard',
    }));

    const sections: NavigationSection[] = [
      {
        id: 'dashboards',
        label: 'Dashboards',
        items: dashboardItems,
        collapsed: false,
      },
      {
        id: 'pages',
        label: 'Pages',
        items: [
          {
            id: 'portfolio',
            label: 'Portfolio',
            icon: 'briefcase',
            path: '/portfolio',
            type: 'page',
          },
          {
            id: 'watchlist',
            label: 'Watchlist',
            icon: 'list',
            path: '/watchlist',
            type: 'page',
          },
          {
            id: 'analytics',
            label: 'Analytics',
            icon: 'bar-chart-2',
            path: '/analytics',
            type: 'page',
          },
        ],
        collapsed: false,
      },
      {
        id: 'settings',
        label: 'Settings',
        items: [
          {
            id: 'account',
            label: 'Account',
            icon: 'user',
            path: '/settings/account',
            type: 'page',
          },
          {
            id: 'preferences',
            label: 'Preferences',
            icon: 'settings',
            path: '/settings/preferences',
            type: 'page',
          },
        ],
        collapsed: true,
      },
    ];

    this.navigationState.sections = sections;
    return sections;
  }

  async updateNavigation(): Promise<NavigationSection[]> {
    return this.buildNavigation();
  }

  setActivePath(path: string): void {
    this.navigationState.activePath = path;
  }

  getActivePath(): string {
    return this.navigationState.activePath;
  }

  getNavigation(): NavigationState {
    return this.navigationState;
  }

  async getDashboardNavigation(): Promise<NavigationItem[]> {
    const dashboards = await dashboardService.listDashboards();
    return dashboards.map((dashboard) => ({
      id: `dashboard-${dashboard.id}`,
      label: dashboard.name,
      icon: 'layout-dashboard',
      path: `/dashboard/${dashboard.id}`,
      type: 'dashboard',
    }));
  }

  toggleSection(sectionId: string): NavigationSection | undefined {
    const section = this.navigationState.sections.find((s) => s.id === sectionId);
    if (section) {
      section.collapsed = !section.collapsed;
    }
    return section;
  }
}

export const navigationService = new NavigationService();