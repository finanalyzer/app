import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandMessage } from '../commandHandler';
import { CommandHandler } from '../commandHandler';

// Mock widgetService
vi.mock('../../widgets/widgetService', () => ({
  widgetService: {
    getWidgets: vi.fn(),
  },
}));

// Mock other services that might be called
vi.mock('../../connections/connectionService', () => ({
  connectionService: {
    getConnections: vi.fn().mockReturnValue([]),
  },
}));

describe('CommandHandler - get_widget_data', () => {
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
   * WD-01: Normal get widget data
   * Given: Valid origin and widget_id
   * When: Calling get_widget_data
   * Then: Should return widget data
   */
  it('WD-01: should return widget data for valid origin and widget_id', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'builtin',
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty('origin', 'builtin');
    expect(result.data).toHaveProperty('widget_id', 'equity-price');
    expect(result.data).toHaveProperty('data');
    expect(result.data).toHaveProperty('timestamp');
  });

  /**
   * WD-02: With data_args parameter
   * Given: Valid origin, widget_id and data_args
   * When: Calling get_widget_data with data_args
   * Then: Should accept data_args (even if not used for filtering)
   */
  it('WD-02: should accept data_args parameter without error', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'builtin',
      widget_id: 'equity-price',
      data_args: { symbol: 'AAPL', interval: '1d' },
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });

  /**
   * WD-03: Invalid widget_id
   * Given: Valid origin but invalid widget_id
   * When: Calling get_widget_data
   * Then: Should return error
   */
  it('WD-03: should return error for invalid widget_id', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'builtin',
      widget_id: 'non-existent-widget',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * WD-04: Invalid origin
   * Given: Invalid origin
   * When: Calling get_widget_data
   * Then: Should return error
   */
  it('WD-04: should return error for invalid origin', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'invalid-source',
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * WD-05: Widget not in Dashboard
   * Given: Widget exists but not in any dashboard
   * When: Calling get_widget_data for a widget not in dashboard
   * Then: Should return empty data (widget exists but no instance data)
   */
  it('WD-05: should return empty data for widget not in any dashboard', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'builtin',
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('data');
    expect(result.data).toHaveProperty('data', []);
  });

  /**
   * Additional test: Missing required parameters
   */
  it('should return error when origin is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('origin and widget_id are required');
  });

  it('should return error when widget_id is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'builtin',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('origin and widget_id are required');
  });

  /**
   * Additional test: With widget_uuid parameter
   */
  it('should include widget_uuid in response when provided', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_widget_data', {
      origin: 'builtin',
      widget_id: 'equity-price',
      widget_uuid: 'test-uuid-123',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('widget_uuid', 'test-uuid-123');
  });
});
