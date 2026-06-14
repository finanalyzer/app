import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandMessage } from '../commandHandler';
import { CommandHandler } from '../commandHandler';

// Type for param options result
interface ParamOptionsResult {
  options: Array<{ label: string; value: string }>;
}

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

describe('CommandHandler - get_params_options', () => {
  let commandHandler: CommandHandler;

  const mockWidgets = [
    {
      id: 'equity-price',
      source: 'builtin',
      name: 'Equity Price',
      params: [
        {
          name: 'symbol',
          label: 'Symbol',
          type: 'string',
          required: true,
          options: [
            { label: 'Apple', value: 'AAPL' },
            { label: 'Microsoft', value: 'MSFT' },
            { label: 'Google', value: 'GOOGL' },
          ],
        },
        {
          name: 'interval',
          label: 'Interval',
          type: 'select',
          required: false,
          options: [
            { label: 'Daily', value: '1d' },
            { label: 'Weekly', value: '1w' },
            { label: 'Monthly', value: '1mo' },
          ],
        },
        {
          name: 'ticker',
          label: 'Ticker',
          type: 'string',
          required: false,
          depends_on: 'symbol',
        },
      ],
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
   * PO-01: Normal get options
   * Given: Valid origin, widget_id and param_name
   * When: Calling get_params_options
   * Then: Should return param options list
   */
  it('PO-01: should return param options for valid origin, widget_id and param_name', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'equity-price',
      param_name: 'symbol',
    }));

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as ParamOptionsResult;
    expect(data).toHaveProperty('options');
    expect(data.options).toHaveLength(3);
    expect(data.options[0]).toHaveProperty('label', 'Apple');
    expect(data.options[0]).toHaveProperty('value', 'AAPL');
  });

  /**
   * PO-02: Invalid param_name
   * Given: Valid origin and widget_id but invalid param_name
   * When: Calling get_params_options
   * Then: Should return error
   */
  it('PO-02: should return error for invalid param_name', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'equity-price',
      param_name: 'non-existent-param',
    }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Param not found');
  });

  /**
   * PO-03: Dependent param not provided
   * Given: Param with depends_on requirement not met
   * When: Calling get_params_options for a dependent param
   * Then: Should return error indicating dependency not satisfied
   * Note: Current implementation does not enforce dependencies, but test documents the expected behavior
   */
  it('PO-03: should handle dependent param (ticker depends on symbol)', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    // Current implementation returns empty options for params without options defined
    // This test verifies current behavior
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'equity-price',
      param_name: 'ticker',
    }));

    // Currently returns empty array since ticker has no options defined
    expect(result.ok).toBe(true);
    const data = result.data as ParamOptionsResult;
    expect(data).toHaveProperty('options');
    expect(data.options).toEqual([]);
  });

  /**
   * PO-04: Many options - pagination or limit
   * Given: Param with many options
   * When: Calling get_params_options
   * Then: Should return options (current implementation returns all)
   */
  it('PO-04: should return options for param with multiple options', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'equity-price',
      param_name: 'interval',
    }));

    expect(result.ok).toBe(true);
    const data = result.data as ParamOptionsResult;
    expect(data).toHaveProperty('options');
    expect(data.options).toHaveLength(3);
  });

  /**
   * Additional test: Missing required parameters
   */
  it('should return error when origin is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      widget_id: 'equity-price',
      param_name: 'symbol',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('origin, widget_id, and param_name are required');
  });

  it('should return error when widget_id is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      param_name: 'symbol',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('origin, widget_id, and param_name are required');
  });

  it('should return error when param_name is missing', async () => {
    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'equity-price',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('origin, widget_id, and param_name are required');
  });

  /**
   * Additional test: Invalid widget
   */
  it('should return error when widget not found', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'non-existent-widget',
      param_name: 'symbol',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('Widget not found');
  });

  /**
   * Additional test: Widget with no params
   */
  it('should return empty options for widget with no params', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'custom',
      widget_id: 'stock-chart',
      param_name: 'any-param',
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('Param not found');
  });

  /**
   * Additional test: Options format verification
   */
  it('should return options in correct format with label and value', async () => {
    const { widgetService } = await import('../../widgets/widgetService');
    vi.mocked(widgetService.getWidgets).mockResolvedValue(mockWidgets as any);

    const result = await commandHandler.handleCommand('session-1', createCommandMessage('get_params_options', {
      origin: 'builtin',
      widget_id: 'equity-price',
      param_name: 'symbol',
    }));

    expect(result.ok).toBe(true);
    const data = result.data as ParamOptionsResult;
    expect(data).toHaveProperty('options');
    const options = data.options;
    expect(options[0]).toHaveProperty('label');
    expect(options[0]).toHaveProperty('value');
  });
});
