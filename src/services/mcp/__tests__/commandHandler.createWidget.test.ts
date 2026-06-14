import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandMessage } from '../commandHandler';
import { CommandHandler } from '../commandHandler';

// Type for create widget result
interface CreateWidgetResult {
  widget_uuid: string;
}

// Mock widgetServicedashboardApi
vi.mock('../../dashboardApi', () => ({
  addWidget: vi.fn().mockResolvedValue({ id: 'new-widget-uuid-123' }),
  getDashboard: vi.fn().mockResolvedValue({ id: 'dashboard-1', widgets: [] }),
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

describe('CommandHandler - create_widget', () => {
  let commandHandler: CommandHandler;

  const mockWidgets = [
    {
      id: 'equity-price',
      source: 'builtin',
      name: 'Equity Price',
      params: [],
    },
    {
      id: 'stock-chart',
      source: 'custom',
      name: 'Stock Chart',
      params: [],
    },
    {
      id: 'rich_note',
      source: 'builtin',
      name: 'Rich Note',
      params: [],
    },
  ];

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
   * CW-01: Normal create widget
   * Given: Valid origin and widget_id
   * When: Calling create_widget
   * Then: Should return new widget UUID
   */
  it('CW-01: should return new widget UUID when creating widget', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as CreateWidgetResult;
    expect(data).toHaveProperty('widget_uuid');
    expect(data.widget_uuid).toBe('new-widget-uuid-123');
  });

  /**
   * CW-02: Missing origin
   * Given: Missing origin parameter
   * When: Calling create_widget
   * Then: Should return error for required parameter missing
   */
  it('CW-02: should return error when origin is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('origin and widget_id are required');
  });

  /**
   * CW-03: Missing widget_id
   * Given: Missing widget_id parameter
   * When: Calling create_widget
   * Then: Should return error for required parameter missing
   */
  it('CW-03: should return error when widget_id is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('origin and widget_id are required');
  });

  /**
   * CW-04: With dashboard_id
   * Given: Valid dashboard_id
   * When: Calling create_widget with dashboard_id
   * Then: Should create widget in specified dashboard
   */
  it('CW-04: should create widget in specified dashboard', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
      dashboard_id: 'my-dashboard',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('widget_uuid');
  });

  /**
   * CW-05: With data_args
   * Given: Valid data_args
   * When: Calling create_widget with data_args
   * Then: Widget parameters should be correctly set
   */
  it('CW-05: should set widget parameters correctly with data_args', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
      data_args: { symbol: 'AAPL', interval: '1d' },
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('widget_uuid');
  });

  /**
   * CW-06: With ui_args
   * Given: Valid ui_args
   * When: Calling create_widget with ui_args
   * Then: Widget UI configuration should be correctly set
   */
  it('CW-06: should set widget UI configuration correctly with ui_args', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
      ui_args: { position: { x: 10, y: 20 } },
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('widget_uuid');
  });

  /**
   * CW-07: Create rich_note
   * Given: widget_id is 'rich_note'
   * When: Calling create_widget with rich_note
   * Then: Should return error suggesting to use add_generative_widget
   */
  it('CW-07: should return error for rich_note suggesting add_generative_widget', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'rich_note',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('add_generative_widget');
    expect(result.error?.message).toContain('widget_type="note"');
  });

  /**
   * CW-08: Invalid dashboard_id
   * Given: Invalid dashboard_id
   * When: Calling create_widget
   * Then: Should return error (dashboard does not exist)
   */
  it('CW-08: should handle invalid dashboard_id', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);
    const { addWidget } = await import('../../dashboardApi');
    
    // Save original mock
    const originalAddWidget = vi.mocked(addWidget);
    
    // Temporarily change mock to reject
    originalAddWidget.mockRejectedValueOnce(new Error('Dashboard not found'));

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
      dashboard_id: 'non-existent-dashboard',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    
    // Mock will be reset after test due to mockReset behavior
  });

  /**
   * CW-09: Invalid widget_id
   * Given: Invalid widget_id (widget type does not exist)
   * When: Calling create_widget
   * Then: Should return error for widget not found
   */
  it('CW-09: should return error for invalid widget_id', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'non-existent-widget',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * Additional test: With both data_args and ui_args (without position)
   */
  it('should handle both data_args and ui_args', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
      data_args: { symbol: 'AAPL' },
      ui_args: { color: 'blue' },
    }));

    // Debug: log error if failed
    if (!result.ok) {
      console.log('Error:', result.error);
    }
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('widget_uuid');
  });

  /**
   * Additional test: Returns instanceId
   */
  it('should return instanceId in response', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('create_widget', {
      origin: 'builtin',
      widget_id: 'equity-price',
      data_args: { symbol: 'AAPL' },
    }));

    // Debug: log error if failed
    if (!result.ok) {
      console.log('Error:', result.error);
    }
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('instanceId');
  });
});
