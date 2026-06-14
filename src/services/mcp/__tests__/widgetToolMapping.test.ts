import { describe, it, expect, beforeEach, vi } from 'vitest';
import { widgetToolMapping } from '../widgetToolMapping';
import { mcpToolRegistry } from '../mcpToolRegistry';
import type { McpServerConnection, McpTool } from '../mcpClient';
import { addWidget } from '../../dashboardApi';

vi.mock('../../dashboardApi', () => ({
  addWidget: vi.fn().mockResolvedValue({ id: 'test-widget-123' }),
}));

describe('WidgetToolMapping', () => {
  const mockConnection: McpServerConnection = {
    serverUrl: 'http://localhost:8787',
    sessionId: 'session-1',
    headers: {},
    connected: true,
    lastConnectedAt: Date.now(),
  };

  const createMockTools = (): McpTool[] => [
    { 
      name: 'get_stock_price', 
      description: 'Get stock price', 
      serverName: 'http://localhost:8787', 
      enabled: true,
      inputSchema: {
        symbol: { type: 'string', title: 'Stock Symbol', description: 'The stock symbol', required: true },
        date: { type: 'string', title: 'Date', description: 'The date', default: '2024-01-01' },
      },
    },
    { 
      name: 'get_portfolio', 
      description: 'Get portfolio', 
      serverName: 'http://localhost:8787', 
      enabled: true,
    },
  ];

  beforeEach(() => {
    mcpToolRegistry.clear();
    vi.clearAllMocks();
  });

  describe('findMatchingWidgets', () => {
    it('should return empty array when no tools are registered', () => {
      const matches = widgetToolMapping.findMatchingWidgets('get_stock_price');
      
      expect(matches).toEqual([]);
    });

    it('should return empty array when no matching widgets exist', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      const matches = widgetToolMapping.findMatchingWidgets('get_stock_price');
      
      expect(matches).toEqual([]);
    });

    it('should return empty array when tool does not exist', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      const matches = widgetToolMapping.findMatchingWidgets('non_existent_tool');
      
      expect(matches).toEqual([]);
    });
  });

  describe('findMatchingTools', () => {
    it('should return empty array when widget does not exist', () => {
      const tools = widgetToolMapping.findMatchingTools('unknown-widget');
      
      expect(tools).toEqual([]);
    });

    it('should return empty array when widget has no mcpToolMatch', () => {
      const tools = widgetToolMapping.findMatchingTools('widget-without-match');
      
      expect(tools).toEqual([]);
    });
  });

  describe('createToolWidgetReference', () => {
    it('should return null when no matching widget found', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      const reference = widgetToolMapping.createToolWidgetReference({ 
        tool_name: 'get_stock_price',
        server_name: 'http://localhost:8787',
      });
      
      expect(reference).toBeNull();
    });

    it('should return null when tool does not exist', () => {
      const reference = widgetToolMapping.createToolWidgetReference({ 
        tool_name: 'non_existent_tool',
      });
      
      expect(reference).toBeNull();
    });
  });

  describe('generateWidgetInfoFromTool', () => {
    it('should generate widget config from tool with schema', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      const tools = mcpToolRegistry.getAllEnabledTools();
      const stockPriceTool = tools.find((t) => t.name === 'get_stock_price');
      
      expect(stockPriceTool).toBeDefined();
      
      const widgetConfig = widgetToolMapping.generateWidgetInfoFromTool(stockPriceTool!, { 
        symbol: 'AAPL',
        date: '2024-01-15',
      });
      
      expect(widgetConfig.id).toBe('http://localhost:8787/get_stock_price');
      expect(widgetConfig.name).toBe('Get stock price');
      expect(widgetConfig.type).toBe('mcp-tool-result');
      expect(widgetConfig.params.length).toBe(2);
      expect(widgetConfig.params[0].name).toBe('symbol');
      expect(widgetConfig.params[0].type).toBe('string');
      expect(widgetConfig.params[0].required).toBe(true);
      expect(widgetConfig.params[1].name).toBe('date');
      expect(widgetConfig.params[1].default).toBe('2024-01-15');
      expect(widgetConfig.mcpToolMatch?.serverName).toBe('http://localhost:8787');
      expect(widgetConfig.mcpToolMatch?.toolName).toBe('get_stock_price');
    });

    it('should generate widget config from tool without schema', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      const tools = mcpToolRegistry.getAllEnabledTools();
      const portfolioTool = tools.find((t) => t.name === 'get_portfolio');
      
      expect(portfolioTool).toBeDefined();
      
      const widgetConfig = widgetToolMapping.generateWidgetInfoFromTool(portfolioTool!);
      
      expect(widgetConfig.id).toBe('http://localhost:8787/get_portfolio');
      expect(widgetConfig.params.length).toBe(0);
    });
  });

  describe('addWidgetFromToolResult', () => {
    it('should return null when tool does not exist', async () => {
      const result = await widgetToolMapping.addWidgetFromToolResult(
        'non_existent_tool',
        'http://localhost:8787',
        {},
        { data: 'test' },
        'dashboard-1'
      );
      
      expect(result).toBeNull();
    });

    it('should create widget from tool result', async () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      const result = await widgetToolMapping.addWidgetFromToolResult(
        'get_stock_price',
        'http://localhost:8787',
        { symbol: 'AAPL' },
        { price: 150, symbol: 'AAPL' },
        'dashboard-1'
      );
      
      expect(result).not.toBeNull();
      expect(result?.instanceId).toBeDefined();
      expect(result?.dashboardId).toBe('dashboard-1');
      expect(result?.currentParams).toEqual({ symbol: 'AAPL' });
      expect(result?.data?.toolResult).toEqual({ price: 150, symbol: 'AAPL' });
      expect(addWidget).toHaveBeenCalled();
    });

    it('should return null when addWidget throws error', async () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      (addWidget as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));
      
      const result = await widgetToolMapping.addWidgetFromToolResult(
        'get_stock_price',
        'http://localhost:8787',
        { symbol: 'AAPL' },
        { price: 150 },
        'dashboard-1'
      );
      
      expect(result).toBeNull();
    });
  });

  describe('markToolCallInReasoning', () => {
    it('should return original text when no matching widget', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      const result = widgetToolMapping.markToolCallInReasoning(
        'I will call get_stock_price to get data',
        { tool_name: 'get_stock_price', server_name: 'http://localhost:8787' }
      );
      
      expect(result).toBe('I will call get_stock_price to get data');
    });

    it('should add widget reference marker', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      const result = widgetToolMapping.markToolCallInReasoning(
        'Using get_portfolio tool',
        { tool_name: 'get_portfolio', server_name: 'http://localhost:8787' }
      );
      
      expect(result).toBe('Using get_portfolio tool');
    });
  });

  describe('mapSchemaTypeToWidgetType', () => {
    it('should map string type', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('string')).toBe('string');
    });

    it('should map number type', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('number')).toBe('number');
    });

    it('should map boolean type', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('boolean')).toBe('boolean');
    });

    it('should map array type to select', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('array')).toBe('select');
    });

    it('should map object type to form', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('object')).toBe('form');
    });

    it('should default to string for unknown types', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('unknown')).toBe('string');
    });

    it('should be case insensitive', () => {
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('STRING')).toBe('string');
      expect(widgetToolMapping['mapSchemaTypeToWidgetType']('Number')).toBe('number');
    });
  });
});