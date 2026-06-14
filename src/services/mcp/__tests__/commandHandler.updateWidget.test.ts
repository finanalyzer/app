import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandMessage } from '../commandHandler';
import { CommandHandler } from '../commandHandler';

// Mock widgetCRUDService
vi.mock('../widgetCRUDService', () => ({
  widgetCRUDService: {
    updateWidget: vi.fn(),
  },
}));

// Mock dashboardApi
vi.mock('../../dashboardApi', () => ({
  getDashboard: vi.fn(),
  updateWidget: vi.fn(),
}));

// Mock widgetService
vi.mock('../../widgets/widgetService', () => ({
  widgetService: {
    getWidgets: vi.fn(),
  },
}));

// Mock other services
vi.mock('../../connections/connectionService', () => ({
  connectionService: {
    getConnections: vi.fn().mockReturnValue([]),
  },
}));

describe('CommandHandler - update_widget', () => {
  let commandHandler: CommandHandler;

  const createCommandMessage = (command: string, args: Record<string, unknown>): CommandMessage => ({
    id: 'test-message-1',
    command,
    args,
  });

  beforeEach(() => {
    commandHandler = new CommandHandler();
    vi.clearAllMocks();
  });

  /**
   * UW-01: Normal update widget
   * Given: Valid widget_uuid and dashboard_id
   * When: Calling update_widget
   * Then: Widget configuration should be updated
   */
  it('UW-01: should update widget configuration', async () => {
    const { widgetCRUDService } = await import('../widgetCRUDService');
    vi.mocked(widgetCRUDService.updateWidget).mockResolvedValue({
      id: 'widget-001',
      instanceId: 'widget-001',
      data: { symbol: 'AAPL' },
      updated: true,
    } as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-001',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });

  /**
   * UW-02: Update data_args
   * Given: Valid data_args
   * When: Calling update_widget with data_args
   * Then: Data parameters should be updated
   */
  it('UW-02: should update data parameters with data_args', async () => {
    const { widgetCRUDService } = await import('../widgetCRUDService');
    vi.mocked(widgetCRUDService.updateWidget).mockResolvedValue({
      id: 'widget-001',
      instanceId: 'widget-001',
      data: { symbol: 'MSFT' },
      updated: true,
    } as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-001',
      data_args: { symbol: 'MSFT', interval: '1d' },
    }));

    expect(result.ok).toBe(true);
    expect(widgetCRUDService.updateWidget).toHaveBeenCalled();
  });

  /**
   * UW-03: Update ui_args
   * Given: Valid ui_args
   * When: Calling update_widget with ui_args
   * Then: UI configuration should be updated
   */
  it('UW-03: should update UI configuration with ui_args', async () => {
    const { widgetCRUDService } = await import('../widgetCRUDService');
    vi.mocked(widgetCRUDService.updateWidget).mockResolvedValue({
      id: 'widget-001',
      instanceId: 'widget-001',
      ui: { color: 'blue' },
      updated: true,
    } as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-001',
      ui_args: { color: 'blue' },
    }));

    expect(result.ok).toBe(true);
    expect(widgetCRUDService.updateWidget).toHaveBeenCalled();
  });

  /**
   * UW-04: Layout args included
   * Given: ui_args contains layout parameters (x, y, w, h)
   * When: Calling update_widget
   * Then: Should return error suggesting to use update_widget_layout
   */
  it('UW-04: should return error when layout args are included', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-001',
      ui_args: { x: 10, y: 20, w: 4, h: 3 },
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('update_widget_layout');
  });

  /**
   * UW-05: Invalid widget_uuid
   * Given: Invalid widget_uuid
   * When: Calling update_widget
   * Then: Should return error for UUID not found
   */
  it('UW-05: should return error for invalid widget_uuid', async () => {
    const { widgetCRUDService } = await import('../widgetCRUDService');
    vi.mocked(widgetCRUDService.updateWidget).mockResolvedValue(undefined);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'non-existent-uuid',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * UW-06: Invalid dashboard_id
   * Given: Invalid dashboard_id
   * When: Calling update_widget
   * Then: Should return error for dashboard not found
   */
  it('UW-06: should return error for invalid dashboard_id', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockRejectedValue(new Error('Dashboard not found'));

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'non-existent-dashboard',
      widget_uuid: 'widget-001',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  /**
   * Additional test: Missing widget_uuid and widget_id
   */
  it('should return error when both widget_uuid and widget_id are missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('widget_uuid or widget_id is required');
  });

  /**
   * Additional test: Missing dashboard_id
   */
  it('should return error when dashboard_id is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      widget_uuid: 'widget-001',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('dashboard_id is required');
  });

  /**
   * Additional test: Update with widget_id instead of widget_uuid
   */
  it('should update widget using widget_id as identifier', async () => {
    const { widgetCRUDService } = await import('../widgetCRUDService');
    vi.mocked(widgetCRUDService.updateWidget).mockResolvedValue({
      id: 'widget-001',
      instanceId: 'widget-001',
      updated: true,
    } as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_id: 'widget-001',
    }));

    expect(result.ok).toBe(true);
  });

  /**
   * Additional test: Update both data_args and ui_args
   */
  it('should update both data and ui configuration', async () => {
    const { widgetCRUDService } = await import('../widgetCRUDService');
    vi.mocked(widgetCRUDService.updateWidget).mockResolvedValue({
      id: 'widget-001',
      instanceId: 'widget-001',
      data: { symbol: 'GOOGL' },
      ui: { color: 'red' },
      updated: true,
    } as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('update_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-001',
      data_args: { symbol: 'GOOGL' },
      ui_args: { color: 'red' },
    }));

    expect(result.ok).toBe(true);
  });
});
