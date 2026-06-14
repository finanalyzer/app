import type { WidgetInstance } from '../../types/widgets';
import { dashboardService } from './dashboardService';

export interface GridLayout {
  columns: number;
  rows: number;
}

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  widgets: WidgetInstance[];
  layout?: GridLayout;
}

export interface AppInstance {
  templateId: string;
  dashboardId: string;
  name: string;
  createdAt: number;
}

export class AppsService {
  private templates: Map<string, AppTemplate> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    const defaultTemplates: AppTemplate[] = [
      {
        id: 'portfolio-overview',
        name: 'Portfolio Overview',
        description: 'A comprehensive view of your portfolio with key metrics and charts',
        category: 'Finance',
        icon: 'wallet',
        widgets: [],
        layout: { columns: 40, rows: 20 },
      },
      {
        id: 'market-dashboard',
        name: 'Market Dashboard',
        description: 'Real-time market data and analysis tools',
        category: 'Finance',
        icon: 'trending-up',
        widgets: [],
        layout: { columns: 40, rows: 20 },
      },
      {
        id: 'analytics-report',
        name: 'Analytics Report',
        description: 'Advanced analytics and reporting dashboard',
        category: 'Analytics',
        icon: 'bar-chart-2',
        widgets: [],
        layout: { columns: 40, rows: 20 },
      },
      {
        id: 'watchlist-monitor',
        name: 'Watchlist Monitor',
        description: 'Track your watchlist with real-time updates',
        category: 'Finance',
        icon: 'eye',
        widgets: [],
        layout: { columns: 40, rows: 20 },
      },
    ];

    defaultTemplates.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  listApps(): AppTemplate[] {
    return Array.from(this.templates.values());
  }

  listAppsByCategory(category: string): AppTemplate[] {
    return Array.from(this.templates.values()).filter((app) => app.category === category);
  }

  getAppDefinition(appId: string): AppTemplate | undefined {
    // First try direct ID lookup
    const byId = this.templates.get(appId);
    if (byId) return byId;

    // Fallback: search by name (case-insensitive)
    return Array.from(this.templates.values()).find(
      (app) => app.name.toLowerCase() === appId.toLowerCase(),
    );
  }

  async instantiateApp(
    appId: string,
    name?: string,
  ): Promise<AppInstance | undefined> {
    // First try direct ID lookup, then fallback to name search
    let template = this.templates.get(appId);
    if (!template) {
      template = Array.from(this.templates.values()).find(
        (app) => app.name.toLowerCase() === appId.toLowerCase(),
      );
    }
    if (!template) {
      return undefined;
    }

    const dashboardName = name || template.name;
    const dashboard = await dashboardService.createDashboard(dashboardName, template.description);

    return {
      templateId: appId,
      dashboardId: dashboard.id,
      name: dashboardName,
      createdAt: Date.now(),
    };
  }

  addTemplate(template: AppTemplate): void {
    this.templates.set(template.id, template);
  }

  removeTemplate(appId: string): boolean {
    return this.templates.delete(appId);
  }

  getCategories(): string[] {
    const categories = new Set(Array.from(this.templates.values()).map((app: { category: string }) => app.category));
    return Array.from(categories) as string[];
  }

  getAppCount(): number {
    return this.templates.size;
  }

  async loadAppsFromConfig(configUrl: string): Promise<void> {
    try {
      const response = await fetch(configUrl);
      const config: AppTemplate[] = await response.json();
      
      config.forEach((template) => {
        this.templates.set(template.id, template);
      });
    } catch {
      // Ignore errors, use default templates
    }
  }
}

export const appsService = new AppsService();
