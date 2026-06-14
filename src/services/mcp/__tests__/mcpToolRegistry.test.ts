import { describe, it, expect, beforeEach } from 'vitest';
import { mcpToolRegistry } from '../mcpToolRegistry';
import type { McpServerConnection, McpTool } from '../mcpClient';

describe('McpToolRegistry', () => {
  const mockConnection: McpServerConnection = {
    serverUrl: 'http://localhost:8787',
    sessionId: 'session-1',
    headers: {},
    connected: true,
    lastConnectedAt: Date.now(),
  };

  const createMockTools = (): McpTool[] => [
    { name: 'get_widget', description: 'Get widget', serverName: 'http://localhost:8787', enabled: true },
    { name: 'create_widget', description: 'Create widget', serverName: 'http://localhost:8787', enabled: true },
    { name: 'delete_widget', description: 'Delete widget', serverName: 'http://localhost:8787', enabled: true },
  ];

  beforeEach(() => {
    mcpToolRegistry.clear();
  });

  describe('Server Registration', () => {
    it('should register server with tools', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      expect(mcpToolRegistry.hasServer('session-1')).toBe(true);
      const entry = mcpToolRegistry.getServer('session-1');
      expect(entry?.serverUrl).toBe('http://localhost:8787');
      expect(entry?.tools.length).toBe(3);
    });

    it('should unregister server', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.unregisterServer('session-1');
      
      expect(mcpToolRegistry.hasServer('session-1')).toBe(false);
    });
  });

  describe('Server Enable/Disable', () => {
    it('should enable server and all tools', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.disableServer('session-1');
      mcpToolRegistry.enableServer('session-1');
      
      const entry = mcpToolRegistry.getServer('session-1');
      expect(entry?.enabled).toBe(true);
      entry?.tools.forEach((tool) => {
        expect(tool.enabled).toBe(true);
      });
    });

    it('should disable server and all tools', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.disableServer('session-1');
      
      const entry = mcpToolRegistry.getServer('session-1');
      expect(entry?.enabled).toBe(false);
      entry?.tools.forEach((tool) => {
        expect(tool.enabled).toBe(false);
      });
    });
  });

  describe('Tool Enable/Disable', () => {
    it('should enable single tool', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.disableTool('session-1', 'get_widget');
      mcpToolRegistry.enableTool('session-1', 'get_widget');
      
      const tool = mcpToolRegistry.getTool('session-1', 'get_widget');
      expect(tool?.enabled).toBe(true);
    });

    it('should disable single tool', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.disableTool('session-1', 'get_widget');
      
      const tool = mcpToolRegistry.getTool('session-1', 'get_widget');
      expect(tool?.enabled).toBe(false);
    });

    it('should leave other tools unaffected when disabling single tool', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.disableTool('session-1', 'get_widget');
      
      const createTool = mcpToolRegistry.getTool('session-1', 'create_widget');
      const deleteTool = mcpToolRegistry.getTool('session-1', 'delete_widget');
      
      expect(createTool?.enabled).toBe(true);
      expect(deleteTool?.enabled).toBe(true);
    });
  });

  describe('Tool Retrieval', () => {
    it('should get all tools by server', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      const tools = mcpToolRegistry.getToolsByServer('session-1');
      
      expect(tools.length).toBe(3);
      expect(tools.map((t) => t.name)).toEqual(['get_widget', 'create_widget', 'delete_widget']);
    });

    it('should get enabled tools by server', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.disableTool('session-1', 'delete_widget');
      
      const enabledTools = mcpToolRegistry.getEnabledToolsByServer('session-1');
      
      expect(enabledTools.length).toBe(2);
      expect(enabledTools.map((t) => t.name)).toEqual(['get_widget', 'create_widget']);
    });

    it('should get all tools from all servers', () => {
      const anotherConnection: McpServerConnection = {
        serverUrl: 'http://localhost:8788',
        sessionId: 'session-2',
        headers: {},
        connected: true,
        lastConnectedAt: Date.now(),
      };
      const anotherTools: McpTool[] = [
        { name: 'get_dashboard', description: 'Get dashboard', serverName: 'http://localhost:8788', enabled: true },
      ];
      
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.registerServer(anotherConnection, [...anotherTools]);
      
      const allTools = mcpToolRegistry.getAllTools();
      expect(allTools.length).toBe(4);
    });

    it('should get all enabled tools from all servers', () => {
      const anotherConnection: McpServerConnection = {
        serverUrl: 'http://localhost:8788',
        sessionId: 'session-2',
        headers: {},
        connected: true,
        lastConnectedAt: Date.now(),
      };
      const anotherTools: McpTool[] = [
        { name: 'get_dashboard', description: 'Get dashboard', serverName: 'http://localhost:8788', enabled: true },
      ];
      
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.registerServer(anotherConnection, [...anotherTools]);
      mcpToolRegistry.disableServer('session-2');
      
      const enabledTools = mcpToolRegistry.getAllEnabledTools();
      expect(enabledTools.length).toBe(3);
      expect(enabledTools.every((t) => t.serverName === 'http://localhost:8787')).toBe(true);
    });

    it('should return empty array for unknown server', () => {
      const tools = mcpToolRegistry.getToolsByServer('unknown');
      expect(tools).toEqual([]);
    });
  });

  describe('Server Retrieval', () => {
    it('should get all servers', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      const servers = mcpToolRegistry.getServers();
      
      expect(servers.length).toBe(1);
      expect(servers[0].serverUrl).toBe('http://localhost:8787');
    });

    it('should check if server exists', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      
      expect(mcpToolRegistry.hasServer('session-1')).toBe(true);
      expect(mcpToolRegistry.hasServer('unknown')).toBe(false);
    });
  });

  describe('Clear Registry', () => {
    it('should clear all entries', () => {
      mcpToolRegistry.registerServer(mockConnection, createMockTools());
      mcpToolRegistry.clear();
      
      expect(mcpToolRegistry.getServers().length).toBe(0);
      expect(mcpToolRegistry.hasServer('session-1')).toBe(false);
    });
  });
});
