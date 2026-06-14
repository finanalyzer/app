import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mcpClient } from '../mcpClient';

describe('McpClient', () => {
  const mockFetch = vi.fn();
  
  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to MCP server and discover tools', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: { capabilities: ['tools/list'] } }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-2', jsonrpc: '2.0', result: [{ name: 'get_widget', description: 'Get widget' }] }),
      });

      const connection = await mcpClient.connect('http://localhost:8787');
      
      expect(connection.serverUrl).toBe('http://localhost:8787');
      expect(connection.connected).toBe(true);
      expect(connection.sessionId).toMatch(/^session_/);
    });

    it('should handle connection failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(mcpClient.connect('http://localhost:8787')).rejects.toThrow();
    });

    it('should handle timeout', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockImplementation(() => Promise.reject(abortError));

      await expect(mcpClient.connect('http://localhost:8787')).rejects.toThrow('Request timed out');
    });

    it('should disconnect from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: {} }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-2', jsonrpc: '2.0', result: [] }),
      });

      const connection = await mcpClient.connect('http://localhost:8787');
      await mcpClient.disconnect(connection.sessionId);
      
      expect(mcpClient.isConnected(connection.sessionId)).toBe(false);
    });
  });

  describe('Tool Discovery', () => {
    it('should discover tools from connected server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: {} }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ 
          id: 'req-2', 
          jsonrpc: '2.0', 
          result: [
            { name: 'get_widget', description: 'Get widget data' },
            { name: 'create_widget', description: 'Create widget' },
          ] 
        }),
      });

      const connection = await mcpClient.connect('http://localhost:8787');
      const tools = mcpClient.getTools(connection.sessionId);
      
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('get_widget');
      expect(tools[1].name).toBe('create_widget');
    });

    it('should return empty array for unknown session', () => {
      const tools = mcpClient.getTools('unknown-session');
      expect(tools).toEqual([]);
    });
  });

  describe('Tool Calling', () => {
    it('should call tool successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: {} }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-2', jsonrpc: '2.0', result: [] }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-3', jsonrpc: '2.0', result: { data: 'success' } }),
      });

      const connection = await mcpClient.connect('http://localhost:8787');
      const result = await mcpClient.callTool(connection.sessionId, 'get_widget', { id: 'test' });
      
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should handle tool call error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: {} }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-2', jsonrpc: '2.0', result: [] }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-3', jsonrpc: '2.0', error: { message: 'Tool error' } }),
      });

      const connection = await mcpClient.connect('http://localhost:8787');
      const result = await mcpClient.callTool(connection.sessionId, 'get_widget', { id: 'test' });
      
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when not connected', async () => {
      const result = await mcpClient.callTool('unknown-session', 'get_widget', {});
      
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('unauthorized');
    });
  });

  describe('Connection State', () => {
    it('should track connection status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: {} }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-2', jsonrpc: '2.0', result: [] }),
      });

      const connection = await mcpClient.connect('http://localhost:8787');
      
      expect(mcpClient.isConnected(connection.sessionId)).toBe(true);
      expect(mcpClient.getConnection(connection.sessionId)).toBeDefined();
    });

    it('should return all connections', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-1', jsonrpc: '2.0', result: {} }),
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'req-2', jsonrpc: '2.0', result: [] }),
      });

      await mcpClient.connect('http://localhost:8787');
      const connections = mcpClient.getConnections();
      
      expect(connections.length).toBeGreaterThan(0);
    });
  });
});
