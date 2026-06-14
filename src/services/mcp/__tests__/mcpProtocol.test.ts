import { describe, it, expect } from 'vitest';
import { mcpProtocol } from '../mcpProtocol';

describe('MCP Protocol Layer', () => {
  describe('JSON-RPC Message Encoding', () => {
    it('should construct initialize request', () => {
      const request = mcpProtocol.encodeJsonRpcRequest('initialize', { sessionId: 'test-session' });
      const parsed = JSON.parse(request);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('initialize');
      expect(parsed.params).toEqual({ sessionId: 'test-session' });
      expect(parsed.id).toBeDefined();
    });

    it('should construct tools/list request', () => {
      const request = mcpProtocol.createToolsListRequest();
      const parsed = JSON.parse(request);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('tools/list');
      expect(parsed.params).toEqual({});
    });

    it('should construct tools/call request with arguments', () => {
      const request = mcpProtocol.createToolsCallRequest('get_widget', { id: 'test-widget' });
      const parsed = JSON.parse(request);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('tools/call');
      expect(parsed.params).toEqual({ toolName: 'get_widget', arguments: { id: 'test-widget' } });
    });

    it('should encode JSON-RPC success response', () => {
      const response = mcpProtocol.encodeJsonRpcResponse({ result: 'success' }, 'req-123');
      const parsed = JSON.parse(response);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.result).toEqual({ result: 'success' });
      expect(parsed.id).toBe('req-123');
    });

    it('should encode JSON-RPC error response', () => {
      const response = mcpProtocol.encodeJsonRpcError(-32600, 'Invalid request', 'req-123', { detail: 'missing param' });
      const parsed = JSON.parse(response);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.error.code).toBe(-32600);
      expect(parsed.error.message).toBe('Invalid request');
      expect(parsed.error.data).toEqual({ detail: 'missing param' });
      expect(parsed.id).toBe('req-123');
    });
  });

  describe('JSON-RPC Message Decoding', () => {
    it('should parse valid JSON-RPC message', () => {
      const message = '{"jsonrpc":"2.0","id":"req-123","method":"tools/list","params":{}}';
      const parsed = mcpProtocol.decodeJsonRpcMessage(message);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe('req-123');
      expect(parsed.method).toBe('tools/list');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => mcpProtocol.decodeJsonRpcMessage('invalid json')).toThrow('Invalid JSON-RPC message');
    });
  });

  describe('SSE Stream Parsing', () => {
    it('should parse single message from SSE stream', () => {
      const sseData = 'data: {"jsonrpc":"2.0","id":"req-1","result":"success"}\n\n';
      const messages = mcpProtocol.parseSseStream(sseData);
      expect(messages.length).toBe(1);
      expect(messages[0].result).toBe('success');
    });

    it('should parse multiple messages from SSE stream', () => {
      const sseData = `data: {"jsonrpc":"2.0","id":"req-1","result":"first"}\n\n` +
                     `data: {"jsonrpc":"2.0","id":"req-2","result":"second"}\n\n`;
      const messages = mcpProtocol.parseSseStream(sseData);
      expect(messages.length).toBe(2);
      expect(messages[0].result).toBe('first');
      expect(messages[1].result).toBe('second');
    });

    it('should handle empty lines and comments', () => {
      const sseData = `: comment line\n` +
                     `data: {"jsonrpc":"2.0","id":"req-1","result":"test"}\n\n`;
      const messages = mcpProtocol.parseSseStream(sseData);
      expect(messages.length).toBe(1);
      expect(messages[0].result).toBe('test');
    });

    it('should handle multi-line data field', () => {
      const sseData = `data: {"jsonrpc":"2.0","id":"req-1","result":\n` +
                     `data: {"nested":"value"}}\n\n`;
      const messages = mcpProtocol.parseSseStream(sseData);
      expect(messages.length).toBe(1);
      expect(messages[0].result).toEqual({ nested: 'value' });
    });
  });

  describe('Session Management', () => {
    it('should create session with unique ID', () => {
      const session = mcpProtocol.createSession('http://localhost:8787/mcp');
      expect(session.sessionId).toMatch(/^session_/);
      expect(session.serverUrl).toBe('http://localhost:8787/mcp');
      expect(session.initialized).toBe(false);
      expect(session.capabilities).toEqual({});
    });

    it('should retrieve existing session', () => {
      const session = mcpProtocol.createSession('http://localhost:8787/mcp');
      const retrieved = mcpProtocol.getSession(session.sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(session.sessionId);
    });

    it('should update session capabilities', () => {
      const session = mcpProtocol.createSession('http://localhost:8787/mcp');
      mcpProtocol.updateSessionCapabilities(session.sessionId, { tools: ['get_widget', 'create_widget'] });
      const updated = mcpProtocol.getSession(session.sessionId);
      expect(updated?.initialized).toBe(true);
      expect(updated?.capabilities).toEqual({ tools: ['get_widget', 'create_widget'] });
    });

    it('should delete session', () => {
      const session = mcpProtocol.createSession('http://localhost:8787/mcp');
      mcpProtocol.deleteSession(session.sessionId);
      expect(mcpProtocol.getSession(session.sessionId)).toBeUndefined();
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = mcpProtocol.generateRequestId();
        expect(id).toMatch(/^req_[a-f0-9]{16}$/);
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });

    it('should generate unique session IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = mcpProtocol.generateSessionId();
        expect(id).toMatch(/^session_[a-f0-9]{32}$/);
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });
  });
});
