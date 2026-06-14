import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandMessage } from '../commandHandler';
import { CommandHandler } from '../commandHandler';

// Type for read widget result
interface ReadWidgetResult {
  instanceId: string;
}

// Mock dashboardApi
vi.mock('../../dashboardApi', () => ({
  getDashboard: vi.fn(),
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

describe('CommandHandler - read_widget', () => {
  let commandHandler: CommandHandler;

  const mockDashboard = {
    id: 'dashboard-1',
    name: 'Test Dashboard',
    widgets: [
      {
        id: 'widget-instance-001',
        type: 'equity-price',
        title: 'Equity Price',
        position: { x: 0, y: 0, w: 4, h: 3 },
        data: { symbol: 'AAPL', interval: '1d' },
      },
      {
        id: 'widget-instance-002',
        type: 'stock-chart',
        title: 'Stock Chart',
        position: { x: 4, y: 0, w: 6, h: 4 },
        data: { ticker: 'MSFT' },
      },
    ],
  };

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
   * RW-01: Read by widget_uuid
   * Given: Valid dashboard_id and widget_uuid
   * When: Calling read_widget with widget_uuid
   * Then: Should return widget instance with exact UUID match
   */
  it('RW-01: should return widget instance when reading by widget_uuid', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-instance-001',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty('instanceId', 'widget-instance-001');
    expect(result.data).toHaveProperty('type', 'equity-price');
    expect(result.data).toHaveProperty('currentParams');
  });

  /**
   * RW-02: Read by widget_id
   * Given: Valid dashboard_id and widget_id
   * When: Calling read_widget with widget_id
   * Then: Should return widget instance (id used as alias)
   */
  it('RW-02: should return widget instance when reading by widget_id', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_id: 'widget-instance-002',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty('instanceId', 'widget-instance-002');
    expect(result.data).toHaveProperty('type', 'stock-chart');
  });

  /**
   * RW-03: Read from specific dashboard
   * Given: Valid dashboard_id and widget identifier
   * When: Calling read_widget with specific dashboard_id
   * Then: Should return widget from specified dashboard
   */
  it('RW-03: should return widget from specified dashboard', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-instance-001',
    }));

    expect(result.ok).toBe(true);
    expect(getDashboard).toHaveBeenCalledWith('dashboard-1');
    expect(result.data).toHaveProperty('dashboardId', 'dashboard-1');
  });

  /**
   * RW-04: Invalid widget_uuid
   * Given: Valid dashboard_id but invalid widget_uuid
   * When: Calling read_widget
   * Then: Should return error for UUID not found
   */
  it('RW-04: should return error for invalid widget_uuid', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'non-existent-uuid',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * RW-05: Invalid widget_id
   * Given: Valid dashboard_id but invalid widget_id
   * When: Calling read_widget
   * Then: Should return error (id not found, no auto-resolution)
   */
  it('RW-05: should return error for invalid widget_id', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_id: 'non-existent-widget',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * RW-06: Invalid dashboard_id
   * Given: Invalid dashboard_id
   * When: Calling read_widget
   * Then: Should return error for dashboard not found
   */
  it('RW-06: should return error for invalid dashboard_id', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue({ id: 'dashboard-1', widgets: [] } as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'non-existent-dashboard',
      widget_uuid: 'widget-instance-001',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * Additional test: Missing dashboard_id
   */
  it('should return error when dashboard_id is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      widget_uuid: 'widget-instance-001',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('dashboard_id is required');
  });

  /**
   * Additional test: Both widget_uuid and widget_id missing
   */
  it('should return error when both widget_uuid and widget_id are missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('widget_uuid or widget_id is required');
  });

  /**
   * Additional test: Widget complete configuration
   */
  it('should return complete widget configuration including data_args and grid_data', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-instance-001',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('currentParams');
    expect(result.data).toHaveProperty('position');
    expect(result.data).toHaveProperty('type');
  });

  /**
   * Additional test: Widget instance is uniquely identified by uuid
   */
  it('should use widget_uuid as the unique instance identifier', async () => {
    const { getDashboard } = await import('../../dashboardApi');
    vi.mocked(getDashboard).mockResolvedValue(mockDashboard as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('read_widget', {
      dashboard_id: 'dashboard-1',
      widget_uuid: 'widget-instance-001',
    }));

    expect(result.ok).toBe(true);
    const data = result.data as ReadWidgetResult;
    expect(data).toHaveProperty('instanceId');
    expect(data.instanceId).toBe('widget-instance-001');
  });
});
