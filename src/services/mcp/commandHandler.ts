import type { CommandMessage, CommandResponse } from './sessionManager';
import { sessionManager } from './sessionManager';
import { snapshotGenerator } from './snapshotGenerator';
import { dashboardService } from './dashboardService';
import { widgetCRUDService } from './widgetCRUDService';
import { widgetService } from '../widgets/widgetService';
import { connectionService } from '../connections/connectionService';
import { appsService } from './appsService';

// Re-export types for test files
export type { CommandMessage, CommandResponse } from './sessionManager';

export type CommandType =
  | 'snapshot.get'
  | 'get_workspace_snapshot'
  | 'list_available_widgets'
  | 'get_widget_schema'
  | 'get_widget_data'
  | 'get_params_options'
  | 'create_widget'
  | 'read_widget'
  | 'update_widget'
  | 'delete_widget'
  | 'update_widget_layout'
  | 'add_generative_widget'
  | 'manage_dashboard'
  | 'manage_navigation_bar'
  | 'navigate_workspace'
  | 'manage_backends'
  | 'manage_apps'
  | 'assign_tasks_to_agents'
  | 'get_skill_content'
  | 'dashboard.create'
  | 'dashboard.read'
  | 'dashboard.update'
  | 'dashboard.delete'
  | 'widget.create'
  | 'widget.read'
  | 'widget.update'
  | 'widget.delete'
  | 'widget.layout.update'
  | 'navigation.navigate'
  | 'navigation.tabs.add'
  | 'navigation.tabs.remove'
  | 'navigation.tabs.rename';

export interface HandlerResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class CommandHandler {
  async handleCommand(_sessionId: string, message: CommandMessage): Promise<CommandResponse> {
    const command = message.command as CommandType;
    
    try {
      const result = await this.routeCommand(command, message.args || {});
      
      return {
        id: message.id,
        ok: result.success,
        data: result.data,
        error: result.error ? { code: 'command_failed', message: result.error } : undefined,
      };
    } catch (error) {
      return {
        id: message.id,
        ok: false,
        error: {
          code: 'command_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async routeCommand(command: CommandType, args: Record<string, unknown>): Promise<HandlerResult> {
    switch (command) {
      case 'snapshot.get':
      case 'get_workspace_snapshot':
        return this.handleSnapshotGet(args);
      case 'list_available_widgets':
        return this.handleListAvailableWidgets(args);
      case 'get_widget_schema':
        return this.handleGetWidgetSchema(args);
      case 'get_widget_data':
        return this.handleGetWidgetData(args);
      case 'get_params_options':
        return this.handleGetParamsOptions(args);
      case 'create_widget':
        return this.handleCreateWidget(args);
      case 'read_widget':
        return this.handleReadWidget(args);
      case 'update_widget':
        return this.handleUpdateWidget(args);
      case 'delete_widget':
        return this.handleDeleteWidget(args);
      case 'update_widget_layout':
        return this.handleUpdateWidgetLayout(args);
      case 'add_generative_widget':
        return this.handleAddGenerativeWidget(args);
      case 'manage_dashboard':
        return this.handleManageDashboard(args);
      case 'manage_navigation_bar':
        return this.handleManageNavigationBar(args);
      case 'navigate_workspace':
        return this.handleNavigateWorkspace(args);
      case 'manage_backends':
        return this.handleManageBackends(args);
      case 'manage_apps':
        return this.handleManageApps(args);
      case 'assign_tasks_to_agents':
        return this.handleAssignTasksToAgents(args);
      case 'get_skill_content':
        return this.handleGetSkillContent(args);
      case 'dashboard.create':
        return this.handleDashboardCreate(args);
      case 'dashboard.read':
        return this.handleDashboardRead(args);
      case 'dashboard.update':
        return this.handleDashboardUpdate(args);
      case 'dashboard.delete':
        return this.handleDashboardDelete(args);
      case 'widget.create':
        return this.handleWidgetCreate(args);
      case 'widget.read':
        return this.handleWidgetRead(args);
      case 'widget.update':
        return this.handleWidgetUpdate(args);
      case 'widget.delete':
        return this.handleWidgetDelete(args);
      case 'widget.layout.update':
        return this.handleWidgetLayoutUpdate(args);
      case 'navigation.navigate':
        return this.handleNavigationNavigate(args);
      case 'navigation.tabs.add':
        return this.handleNavigationTabsAdd(args);
      case 'navigation.tabs.remove':
        return this.handleNavigationTabsRemove(args);
      case 'navigation.tabs.rename':
        return this.handleNavigationTabsRename(args);
      default:
        return { success: false, error: `Unknown command: ${command}` };
    }
  }

  private async handleSnapshotGet(_args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const snapshot = await snapshotGenerator.generateSnapshot();
      return { success: true, data: snapshot };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate snapshot' };
    }
  }

  private async handleListAvailableWidgets(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const origin = args.origin as string | undefined;
      const backendId = args.backend_id as string | undefined;
      
      const widgets = await widgetService.getWidgets();
      
      let filteredWidgets = widgets;
      
      // Filter by origin if provided (supports empty string filtering)
      if (origin !== undefined && origin !== null) {
        filteredWidgets = filteredWidgets.filter((w) => w.source === origin);
      }
      
      // Filter by backend_id if provided
      if (backendId !== undefined && backendId !== null) {
        filteredWidgets = filteredWidgets.filter((w) => w.connectionId === backendId);
      }
      
      const result = filteredWidgets.map((widget) => ({
        origin: widget.source || '',
        widget_id: widget.id,
        name: widget.name,
        description: widget.description,
        category: widget.category,
      }));
      
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list available widgets' };
    }
  }

  private async handleGetWidgetSchema(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      if (typeof args.origin !== 'string') {
        return { success: false, error: 'origin must be a string' };
      }
      if (typeof args.widget_id !== 'string') {
        return { success: false, error: 'widget_id must be a string' };
      }
      
      const origin = args.origin;
      const widgetId = args.widget_id;
      
      const widgets = await widgetService.getWidgets();
      const widget = widgets.find((w) => w.source === origin && w.id === widgetId);
      
      if (!widget) {
        return { success: false, error: `Widget not found: ${origin}/${widgetId}` };
      }
      
      const schema = {
        origin: widget.source,
        widget_id: widget.id,
        name: widget.name,
        description: widget.description,
        category: widget.category,
        params: widget.params || [],
        grid_data: widget.gridData || { w: 4, h: 3 },
      };
      
      return { success: true, data: schema };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get widget schema' };
    }
  }

  private async handleDashboardCreate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const name = args.name as string;
      const description = args.description as string | undefined;
      const dashboard = await dashboardService.createDashboard(name, description);
      return { success: true, data: dashboard };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create dashboard' };
    }
  }

  private async handleDashboardRead(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const dashboard = await dashboardService.getDashboardInfo(dashboardId);
      return { success: true, data: dashboard };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to read dashboard' };
    }
  }

  private async handleDashboardUpdate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const updates = {
        name: args.name as string | undefined,
        description: args.description as string | undefined,
      };
      const dashboard = await dashboardService.updateDashboard(dashboardId, updates);
      return { success: true, data: dashboard };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update dashboard' };
    }
  }

  private async handleDashboardDelete(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      await dashboardService.deleteDashboard(dashboardId);
      return { success: true, data: { deleted: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete dashboard' };
    }
  }

  private async handleWidgetCreate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const widgetData = args.widget as Record<string, unknown>;
      const widget = await widgetCRUDService.createWidget(dashboardId, widgetData);
      return { success: true, data: widget };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create widget' };
    }
  }

  private async handleWidgetRead(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const widgetId = args.widgetId as string;
      const widget = await widgetCRUDService.readWidget(dashboardId, widgetId);
      return { success: true, data: widget };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to read widget' };
    }
  }

  private async handleWidgetUpdate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const widgetId = args.widgetId as string;
      const updates = args.updates as Record<string, unknown>;
      const widget = await widgetCRUDService.updateWidget(dashboardId, widgetId, updates);
      return { success: true, data: widget };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update widget' };
    }
  }

  private async handleWidgetDelete(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const widgetId = args.widgetId as string;
      await widgetCRUDService.deleteWidget(dashboardId, widgetId);
      return { success: true, data: { deleted: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete widget' };
    }
  }

  private async handleWidgetLayoutUpdate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const widgetId = args.widgetId as string;
      const layout = args.layout as Record<string, unknown>;
      const result = await widgetCRUDService.updateWidgetLayout(dashboardId, widgetId, layout);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update widget layout' };
    }
  }

  private async handleNavigationNavigate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const tabId = args.tabId as string | undefined;
      await sessionManager.updateContext(args.sessionId as string, {
        activeDashboard: dashboardId,
        activeTab: tabId,
      });
      return { success: true, data: { dashboardId, tabId } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to navigate' };
    }
  }

  private async handleNavigationTabsAdd(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const tabName = args.tabName as string;
      const result = await dashboardService.addTab(dashboardId, tabName);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add tab' };
    }
  }

  private async handleNavigationTabsRemove(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const tabId = args.tabId as string;
      const result = await dashboardService.removeTab(dashboardId, tabId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove tab' };
    }
  }

  private async handleNavigationTabsRename(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const dashboardId = args.dashboardId as string;
      const tabId = args.tabId as string;
      const newName = args.newName as string;
      const result = await dashboardService.renameTab(dashboardId, tabId, newName);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to rename tab' };
    }
  }

  private async handleManageBackends(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const operation = args.operation as string;

      if (!operation) {
        return { success: false, error: 'operation is required' };
      }

      switch (operation) {
        case 'list':
          return this.handleManageBackendsList();
        case 'add':
          return this.handleManageBackendsAdd(args);
        case 'update':
          return this.handleManageBackendsUpdate(args);
        case 'refresh':
          return this.handleManageBackendsRefresh(args);
        case 'remove':
          return this.handleManageBackendsRemove(args);
        default:
          return { success: false, error: `Invalid operation: ${operation}. Must be one of: list, add, update, refresh, remove` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to manage backends' };
    }
  }

  private async handleManageBackendsList(): Promise<HandlerResult> {
    try {
      const connections = connectionService.getConnections();
      
      const result = connections.map((conn) => ({
        id: conn.id,
        name: conn.name,
        url: conn.url,
        status: conn.status,
        widget_count: conn.metrics.widgets,
        app_count: conn.metrics.apps,
        agent_count: conn.metrics.agents,
      }));
      
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list backends' };
    }
  }

  private async handleManageBackendsAdd(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const name = args.name as string;
      const url = args.url as string;
      const endpointHeaders = args.endpoint_headers as Array<{ key: string; value: string; location: 'headers' | 'query' }> | undefined;
      const validateWidgets = args.validate_widgets as boolean | undefined;

      if (!name) {
        return { success: false, error: 'name is required' };
      }
      if (!url) {
        return { success: false, error: 'url is required' };
      }

      const authentication: Array<{ key: string; value: string; location: 'header' | 'query' }> = endpointHeaders?.map((header) => ({
        key: header.key,
        value: header.value,
        location: (header.location === 'headers' ? 'header' : header.location) as 'header' | 'query',
      })) || [];

      const connection = connectionService.createConnection({
        name,
        url,
        apiKey: '',
        validateWidgets: validateWidgets !== false,
        authentication,
      });

      if (validateWidgets !== false) {
        await connectionService.testConnection(connection.id);
      }

      const result = {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        status: connection.status,
        widget_count: connection.metrics.widgets,
        app_count: connection.metrics.apps,
        agent_count: connection.metrics.agents,
      };

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add backend' };
    }
  }

  private async handleManageBackendsUpdate(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const backendId = args.backend_id as string;

      if (!backendId) {
        return { success: false, error: 'backend_id is required' };
      }

      const updates: Record<string, unknown> = {};

      if (args.name !== undefined) {
        updates.name = args.name as string;
      }
      if (args.url !== undefined) {
        updates.url = args.url as string;
      }
      if (args.endpoint_headers != null) {
        updates.authentication = (args.endpoint_headers as Array<{ key: string; value: string; location: 'headers' | 'query' }>).map((header) => ({
          key: header.key,
          value: header.value,
          location: (header.location === 'headers' ? 'header' : header.location) as 'header' | 'query',
        }));
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'At least one update field is required (name, url, or endpoint_headers)' };
      }

      const connection = connectionService.updateConnection(backendId, updates as any);

      if (!connection) {
        return { success: false, error: `Backend not found: ${backendId}` };
      }

      const result = {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        status: connection.status,
        widget_count: connection.metrics.widgets,
        app_count: connection.metrics.apps,
        agent_count: connection.metrics.agents,
      };

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update backend' };
    }
  }

  private async handleManageBackendsRefresh(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const backendId = args.backend_id as string;

      if (!backendId) {
        return { success: false, error: 'backend_id is required' };
      }

      const connection = await connectionService.refreshConnection(backendId);

      if (!connection) {
        return { success: false, error: `Backend not found: ${backendId}` };
      }

      const result = {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        status: connection.status,
        widget_count: connection.metrics.widgets,
        app_count: connection.metrics.apps,
        agent_count: connection.metrics.agents,
      };

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to refresh backend' };
    }
  }

  private async handleManageBackendsRemove(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const backendId = args.backend_id as string;

      if (!backendId) {
        return { success: false, error: 'backend_id is required' };
      }

      const deleted = connectionService.deleteConnection(backendId);

      if (!deleted) {
        return { success: false, error: `Backend not found: ${backendId}` };
      }

      return { success: true, data: { deleted: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove backend' };
    }
  }

  private async handleGetWidgetData(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const origin = args.origin as string;
      const widgetId = args.widget_id as string;
      const widgetUuid = args.widget_uuid as string | undefined;

      if (!origin || !widgetId) {
        return { success: false, error: 'origin and widget_id are required' };
      }

      const widgets = await widgetService.getWidgets();
      const widget = widgets.find((w) => w.source === origin && w.id === widgetId);

      if (!widget) {
        return { success: false, error: `Widget not found: ${origin}/${widgetId}` };
      }

      const mockData = {
        origin,
        widget_id: widgetId,
        widget_uuid: widgetUuid,
        data: [],
        timestamp: Date.now(),
      };

      return { success: true, data: mockData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get widget data' };
    }
  }

  private async handleGetParamsOptions(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const origin = args.origin as string;
      const widgetId = args.widget_id as string;
      const paramName = args.param_name as string;

      if (!origin || !widgetId || !paramName) {
        return { success: false, error: 'origin, widget_id, and param_name are required' };
      }

      const widgets = await widgetService.getWidgets();
      const widget = widgets.find((w) => w.source === origin && w.id === widgetId);

      if (!widget) {
        return { success: false, error: `Widget not found: ${origin}/${widgetId}` };
      }

      const param = widget.params?.find((p) => p.name === paramName);
      if (!param) {
        return { success: false, error: `Param not found: ${paramName}` };
      }

      const options = param.options || [];

      return { success: true, data: { options } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get params options' };
    }
  }

  private async handleCreateWidget(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const origin = args.origin as string;
      const widgetId = args.widget_id as string;
      const dashboardId = args.dashboard_id as string | undefined;
      const dataArgs = args.data_args as Record<string, unknown> | undefined;
      const uiArgs = args.ui_args as Record<string, unknown> | undefined;

      if (!origin || !widgetId) {
        return { success: false, error: 'origin and widget_id are required' };
      }

      const widgets = await widgetService.getWidgets();
      const widget = widgets.find((w) => w.source === origin && w.id === widgetId);

      if (!widget) {
        return { success: false, error: `Widget not found: ${origin}/${widgetId}` };
      }

      if (widgetId === 'rich_note') {
        return { success: false, error: 'create_widget does not support rich_note. Use add_generative_widget with widget_type="note" instead.' };
      }

      const widgetData = {
        id: widgetId,
        type: widgetId,
        name: widget.name,
        params: dataArgs,
        position: uiArgs?.position || { x: 0, y: 0 },
      };

      const result = await widgetCRUDService.createWidget(dashboardId || '', widgetData);

      return { success: true, data: { widget_uuid: result.instanceId, ...result } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create widget' };
    }
  }

  private async handleReadWidget(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const widgetUuid = args.widget_uuid as string | undefined;
      const widgetId = args.widget_id as string | undefined;
      const dashboardId = args.dashboard_id as string | undefined;

      if (!widgetUuid && !widgetId) {
        return { success: false, error: 'widget_uuid or widget_id is required' };
      }

      if (!dashboardId) {
        return { success: false, error: 'dashboard_id is required' };
      }

      const result = await widgetCRUDService.readWidget(dashboardId, widgetUuid || widgetId || '');

      if (!result) {
        return { success: false, error: 'Widget not found' };
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to read widget' };
    }
  }

  private async handleUpdateWidget(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const widgetUuid = args.widget_uuid as string | undefined;
      const widgetId = args.widget_id as string | undefined;
      const dashboardId = args.dashboard_id as string | undefined;
      const dataArgs = args.data_args as Record<string, unknown> | undefined;
      const uiArgs = args.ui_args as Record<string, unknown> | undefined;

      if (!widgetUuid && !widgetId) {
        return { success: false, error: 'widget_uuid or widget_id is required' };
      }

      if (!dashboardId) {
        return { success: false, error: 'dashboard_id is required' };
      }

      const hasLayoutArgs = uiArgs && (('x' in uiArgs) || ('y' in uiArgs) || ('w' in uiArgs) || ('h' in uiArgs));
      if (hasLayoutArgs) {
        return { success: false, error: 'update_widget only supports widget-instance config changes. Use update_widget_layout for x, y, w, h.' };
      }

      const updates: Record<string, unknown> = {};
      if (dataArgs) updates.data = dataArgs;
      if (uiArgs) updates.ui = uiArgs;

      const result = await widgetCRUDService.updateWidget(dashboardId, widgetUuid || widgetId || '', updates);

      if (!result) {
        return { success: false, error: 'Widget not found' };
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update widget' };
    }
  }

  private async handleDeleteWidget(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const widgetUuid = args.widget_uuid as string | undefined;
      const widgetId = args.widget_id as string | undefined;
      const dashboardId = args.dashboard_id as string | undefined;

      if (!widgetUuid && !widgetId) {
        return { success: false, error: 'widget_uuid or widget_id is required' };
      }

      if (!dashboardId) {
        return { success: false, error: 'dashboard_id is required' };
      }

      await widgetCRUDService.deleteWidget(dashboardId, widgetUuid || widgetId || '');

      return { success: true, data: { deleted: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete widget' };
    }
  }

  private async handleUpdateWidgetLayout(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const x = args.x as number;
      const y = args.y as number;
      const w = args.w as number;
      const h = args.h as number;
      const widgetUuid = args.widget_uuid as string | undefined;
      const widgetId = args.widget_id as string | undefined;
      const dashboardId = args.dashboard_id as string | undefined;
      const tabId = args.tab_id as string | undefined;

      if (x === undefined || y === undefined || w === undefined || h === undefined) {
        return { success: false, error: 'x, y, w, h are required' };
      }

      if (!widgetUuid && !widgetId) {
        return { success: false, error: 'widget_uuid or widget_id is required' };
      }

      const layout = { x, y, w, h, tabId };
      const result = await widgetCRUDService.updateWidgetLayout(dashboardId || '', widgetUuid || widgetId || '', layout);

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update widget layout' };
    }
  }

  private async handleAddGenerativeWidget(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const widgetType = args.widget_type as string;
      const dashboardId = args.dashboard_id as string | undefined;
      const data = args.data as string | Array<Record<string, unknown>> | undefined;
      const name = args.name as string | undefined;
      const description = args.description as string | undefined;
      const chartParams = args.chart_params as Record<string, unknown> | undefined;
      const innerTab = args.inner_tab as string | undefined;

      const allowedTypes = ['note', 'table', 'chart', 'html'];
      if (!widgetType || !allowedTypes.includes(widgetType)) {
        return { success: false, error: `widget_type must be one of: ${allowedTypes.join(', ')}` };
      }

      if (!data) {
        return { success: false, error: 'data is required' };
      }

      if ((widgetType === 'note' || widgetType === 'html') && typeof data !== 'string') {
        return { success: false, error: `data must be a string for ${widgetType} widget_type` };
      }

      if ((widgetType === 'table' || widgetType === 'chart') && !Array.isArray(data)) {
        return { success: false, error: `data must be an array for ${widgetType} widget_type` };
      }

      if (widgetType === 'chart') {
        if (!chartParams) {
          return { success: false, error: 'chart widget_type requires chart_params with chartType, xKey, and non-empty yKey' };
        }
        if (typeof chartParams.chartType !== 'string' || !chartParams.chartType) {
          return { success: false, error: 'chart_params.chartType must be a non-empty string' };
        }
        if (typeof chartParams.xKey !== 'string' || !chartParams.xKey) {
          return { success: false, error: 'chart_params.xKey must be a non-empty string' };
        }
        const yKey = chartParams.yKey;
        if (!Array.isArray(yKey) || yKey.length === 0) {
          return { success: false, error: 'chart_params.yKey must be a non-empty array' };
        }
      }

      // Validate inner_tab exists in the dashboard if provided
      if (innerTab && dashboardId) {
        const dashboard = await dashboardService.getDashboardInfo(dashboardId);
        if (!dashboard) {
          return { success: false, error: `Dashboard not found: ${dashboardId}` };
        }
        const tabExists = dashboard.tabIds?.includes(innerTab);
        if (!tabExists) {
          return { success: false, error: `Tab not found: ${innerTab} in dashboard ${dashboardId}` };
        }
      }

      const widgetData = {
        id: `generative-${widgetType}-${Date.now()}`,
        type: `built-in-${widgetType}`,
        name: name || `Generated ${widgetType}`,
        description: description || '',
        data,
        chartParams,
        innerTab,
        position: { x: 0, y: 0 },
      };

      const result = await widgetCRUDService.createWidget(dashboardId || '', widgetData);

      return { success: true, data: { widget_uuid: result.instanceId, ...result } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add generative widget' };
    }
  }

  private async handleManageDashboard(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const operation = args.operation as string;

      if (!operation) {
        return { success: false, error: 'operation is required' };
      }

      switch (operation) {
        case 'create': {
          const name = args.name as string;
          const activate = args.activate as boolean | undefined;

          if (!name) {
            return { success: false, error: 'name is required for create operation' };
          }

          const dashboard = await dashboardService.createDashboard(name, undefined);

          if (activate !== false) {
            await sessionManager.updateContext('', { activeDashboard: dashboard.id });
          }

          return { success: true, data: { dashboard_id: dashboard.id, ...dashboard } };
        }
        case 'read': {
          const dashboardId = args.dashboard_id as string | undefined;

          if (!dashboardId) {
            return { success: false, error: 'dashboard_id is required for read operation' };
          }

          const dashboard = await dashboardService.getDashboardInfo(dashboardId);
          if (!dashboard) {
            return { success: false, error: 'Dashboard not found' };
          }
          return { success: true, data: dashboard };
        }
        case 'update': {
          const dashboardId = args.dashboard_id as string;
          const name = args.name as string;

          if (!dashboardId) {
            return { success: false, error: 'dashboard_id is required for update operation' };
          }
          if (name === undefined) {
            return { success: false, error: 'name is required for update operation' };
          }

          const dashboard = await dashboardService.updateDashboard(dashboardId, { name });
          return { success: true, data: dashboard };
        }
        default:
          return { success: false, error: `Invalid operation: ${operation}. Must be one of: create, read, update` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to manage dashboard' };
    }
  }

  private async handleManageNavigationBar(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const operation = args.operation as string;
      const dashboardId = args.dashboard_id as string | undefined;
      const tabs = args.tabs as Array<Record<string, unknown>> | undefined;
      const renameMap = args.rename_map as Record<string, string> | undefined;

      if (!operation) {
        return { success: false, error: 'operation is required' };
      }

      const allowedOperations = ['create', 'add_tabs', 'remove_tabs', 'rename_tabs'];
      if (!allowedOperations.includes(operation)) {
        return { success: false, error: `Invalid operation: ${operation}. Must be one of: ${allowedOperations.join(', ')}` };
      }

      if (operation === 'rename_tabs') {
        if (!renameMap || Object.keys(renameMap).length === 0) {
          return { success: false, error: 'rename_map is required for rename_tabs operation' };
        }

        for (const [tabId, newName] of Object.entries(renameMap)) {
          await dashboardService.renameTab(dashboardId || '', tabId, newName);
        }

        return { success: true, data: { renamed: Object.keys(renameMap).length } };
      }

      if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
        return { success: false, error: `tabs is required for ${operation} operation` };
      }

      for (const tab of tabs) {
        if (typeof tab !== 'object' || !('name' in tab)) {
          return { success: false, error: 'tabs must be an array of objects with name field' };
        }
      }

      switch (operation) {
        case 'create':
        case 'add_tabs': {
          const results: Array<Record<string, unknown>> = [];
          for (const tab of tabs) {
            const result = await dashboardService.addTab(dashboardId || '', tab.name as string);
            results.push(result as unknown as Record<string, unknown>);
          }
          return { success: true, data: { tabs: results } };
        }
        case 'remove_tabs': {
          const results: Array<Record<string, unknown>> = [];
          for (const tab of tabs) {
            const tabId = tab.id as string;
            const result = await dashboardService.removeTab(dashboardId || '', tabId);
            results.push(result as unknown as Record<string, unknown>);
          }
          return { success: true, data: { removed: results.length } };
        }
        default:
          return { success: false, error: `Invalid operation: ${operation}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to manage navigation bar' };
    }
  }

  private async handleNavigateWorkspace(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const operation = args.operation as string;
      const dashboardId = args.dashboard_id as string | undefined;
      const tabId = args.tab_id as string | undefined;

      if (!operation) {
        return { success: false, error: 'operation is required' };
      }

      const allowedOperations = ['dashboard', 'tab'];
      if (!allowedOperations.includes(operation)) {
        return { success: false, error: `Invalid operation: ${operation}. Must be one of: ${allowedOperations.join(', ')}` };
      }

      if (operation === 'dashboard') {
        if (!dashboardId) {
          return { success: false, error: 'dashboard_id is required for dashboard operation' };
        }

        await sessionManager.updateContext('', {
          activeDashboard: dashboardId,
          activeTab: tabId,
        });

        return { success: true, data: { dashboard_id: dashboardId, tab_id: tabId } };
      }

      if (operation === 'tab') {
        if (!tabId) {
          return { success: false, error: 'tab_id is required for tab operation' };
        }

        await sessionManager.updateContext('', {
          activeTab: tabId,
          activeDashboard: dashboardId,
        });

        return { success: true, data: { tab_id: tabId, dashboard_id: dashboardId } };
      }

      return { success: false, error: `Invalid operation: ${operation}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to navigate workspace' };
    }
  }

  private async handleManageApps(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const operation = args.operation as string;
      const backendId = args.backend_id as string;
      const appName = args.app_name as string | undefined;
      const templateId = args.template_id as string | undefined;
      const dashboardName = args.dashboard_name as string | undefined;
      const activate = args.activate as boolean | undefined;

      if (!operation) {
        return { success: false, error: 'operation is required' };
      }

      const allowedOperations = ['list', 'read', 'instantiate'];
      if (!allowedOperations.includes(operation)) {
        return { success: false, error: `Invalid operation: ${operation}. Must be one of: ${allowedOperations.join(', ')}` };
      }

      if (!backendId) {
        return { success: false, error: 'backend_id is required' };
      }

      // Validate backend_id exists
      const connections = connectionService.getConnections();
      const backendExists = connections.some((conn) => conn.id === backendId);
      if (!backendExists) {
        return { success: false, error: `Backend not found: ${backendId}` };
      }

      switch (operation) {
        case 'list': {
          const apps = appsService.listApps().map((app) => ({
            name: app.name,
            template_id: app.id,
            description: app.description,
            category: app.category,
            tab_count: 1,
            group_count: 0,
            prompt_count: 0,
            allow_customization: true,
          }));
          return { success: true, data: apps };
        }
        case 'read': {
          if (!appName && !templateId) {
            return { success: false, error: 'app_name or template_id is required for read operation' };
          }

          const app = appsService.getAppDefinition(appName || templateId || '');
          if (!app) {
            return { success: false, error: `App not found: ${appName || templateId}` };
          }
          return { success: true, data: app };
        }
        case 'instantiate': {
          if (!appName && !templateId) {
            return { success: false, error: 'app_name or template_id is required for instantiate operation' };
          }

          const result = await appsService.instantiateApp(appName || templateId || '', dashboardName);
          if (!result) {
            return { success: false, error: `App not found: ${appName || templateId}` };
          }

          if (activate !== false) {
            await sessionManager.updateContext('', { activeDashboard: result.dashboardId });
          }

          return { success: true, data: { dashboard_id: result.dashboardId, ...result } };
        }
        default:
          return { success: false, error: `Invalid operation: ${operation}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to manage apps' };
    }
  }

  private async handleAssignTasksToAgents(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const taskRequests = args.task_requests as Array<Record<string, unknown>> | undefined;

      if (!taskRequests || !Array.isArray(taskRequests) || taskRequests.length === 0) {
        return { success: false, error: 'task_requests is required' };
      }

      const connections = connectionService.getConnections();
      const connectedConnections = connections.filter((c) => c.status === 'connected');

      const results: Array<Record<string, unknown>> = [];
      for (const task of taskRequests) {
        if (!task.id || !task.description) {
          return { success: false, error: 'Each task must have id and description' };
        }

        const assignedHolderUrl = task.assigned_holder_url as string | undefined;
        const assignedAgentId = task.assigned_agent_id as string | undefined;

        // Validate assigned_holder_url: must match a configured connection
        if (assignedHolderUrl) {
          const normalizedTaskUrl = assignedHolderUrl.replace(/\/+$/, '');
          const matchingConn = connections.find(
            (conn) => conn.url && conn.url.replace(/\/+$/, '') === normalizedTaskUrl,
          );

          if (!matchingConn) {
            return {
              success: false,
              error: `Backend not found for assigned_holder_url: ${assignedHolderUrl}`,
            };
          }

          // If assigned_agent_id is also provided, validate it exists on the backend
          if (assignedAgentId) {
            const baseUrl = matchingConn.url.replace(/\/+$/, '');
            try {
              const agentsUrl = `${baseUrl}/agents.json`;
              const response = await fetch(agentsUrl);

              if (!response.ok) {
                return {
                  success: false,
                  error: `No agents available at backend: ${assignedHolderUrl}`,
                };
              }

              const agentsData = await response.json();
              if (!agentsData || typeof agentsData !== 'object' || !agentsData[assignedAgentId]) {
                return {
                  success: false,
                  error: `assigned_agent_id not found: ${assignedAgentId} at backend: ${assignedHolderUrl}`,
                };
              }
            } catch {
              return {
                success: false,
                error: `Failed to verify agent at backend: ${assignedHolderUrl}`,
              };
            }
          }
        } else if (assignedAgentId) {
          // No holder URL specified, check all connected backends for the agent
          if (connectedConnections.length === 0) {
            return {
              success: false,
              error: 'No connected backends available to assign task',
            };
          }

          let agentFound = false;
          for (const conn of connectedConnections) {
            if (!conn.url) continue;
            try {
              const baseUrl = conn.url.replace(/\/+$/, '');
              const agentsUrl = `${baseUrl}/agents.json`;
              const response = await fetch(agentsUrl);
              if (response.ok) {
                const agentsData = await response.json();
                if (agentsData && typeof agentsData === 'object' && agentsData[assignedAgentId]) {
                  agentFound = true;
                  break;
                }
              }
            } catch {
              // Try next connection
            }
          }

          if (!agentFound) {
            return {
              success: false,
              error: `assigned_agent_id not found on any connected backend: ${assignedAgentId}`,
            };
          }
        }

        results.push({
          id: task.id,
          status: 'assigned',
          message: 'Task assigned successfully',
          assigned_holder_url: assignedHolderUrl || null,
          assigned_agent_id: assignedAgentId || null,
        });
      }

      return { success: true, data: { tasks: results } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign tasks to agents',
      };
    }
  }

  private async handleGetSkillContent(args: Record<string, unknown>): Promise<HandlerResult> {
    try {
      const slug = args.slug as string;
      const reason = args.reason as string | undefined;

      if (!slug) {
        return { success: false, error: 'slug is required' };
      }

      const availableSkills: Record<string, { title: string; description: string; content: string }> = {
        'stock-analyzer': {
          title: 'Stock Analyzer',
          description: 'Analyze stock fundamentals, technicals, and market sentiment',
          content: '# Stock Analyzer Skill\n\nA comprehensive stock analysis skill that evaluates company fundamentals, technical indicators, and market conditions.\n\n## Capabilities\n- Fundamental analysis\n- Technical analysis\n- Market sentiment evaluation\n- Risk assessment',
        },
        'portfolio-manager': {
          title: 'Portfolio Manager',
          description: 'Manage investment portfolios with rebalancing and risk tracking',
          content: '# Portfolio Manager Skill\n\nTracks portfolio performance, suggests rebalancing, and monitors risk exposure.\n\n## Capabilities\n- Portfolio tracking\n- Rebalancing suggestions\n- Risk monitoring\n- Performance attribution',
        },
        'market-reporter': {
          title: 'Market Reporter',
          description: 'Generate market reports and summaries',
          content: '# Market Reporter Skill\n\nGenerates comprehensive market reports with key metrics and insights.\n\n## Capabilities\n- Market overview generation\n- Sector analysis\n- News summarization\n- Trend identification',
        },
      };

      const skill = availableSkills[slug];
      if (!skill) {
        return { success: false, error: `Skill not found: ${slug}` };
      }

      const skillContent = {
        slug,
        reason,
        content: skill.content,
        metadata: {
          title: skill.title,
          description: skill.description,
        },
      };

      return { success: true, data: skillContent };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get skill content' };
    }
  }
}

export const commandHandler = new CommandHandler();