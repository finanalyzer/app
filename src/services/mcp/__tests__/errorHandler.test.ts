import { describe, it, expect } from 'vitest';

// BridgeError-compatible test error handler
function createTestError(
  code: 'invalid_request' | 'unauthorized' | 'unavailable' | 'timeout' | 'command_failed' | 'unknown',
  message: string,
  details?: Record<string, unknown>,
  retryable = false,
) {
  return { code, message, details, retryable };
}

const mcpErrorHandler = {
  invalidRequest: (message: string, details?: Record<string, unknown>) =>
    createTestError('invalid_request', message, details, false),
  unauthorized: (message: string) =>
    createTestError('unauthorized', message, undefined, false),
  unavailable: (message: string) =>
    createTestError('unavailable', message, undefined, true),
  timeout: (message: string) =>
    createTestError('timeout', message, undefined, true),
  commandFailed: (message: string) =>
    createTestError('command_failed', message, undefined, false),
  unknown: (message: string) =>
    createTestError('unknown', message, undefined, false),
  fromError: (error: Error) => {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout')) return createTestError('timeout', error.message, undefined, true);
    if (msg.includes('unauthorized') || msg.includes('permission'))
      return createTestError('unauthorized', error.message);
    if (msg.includes('invalid')) return createTestError('invalid_request', error.message);
    return createTestError('unknown', error.message);
  },
  formatError: (error: { code: string; message: string; details?: Record<string, unknown>; retryable?: boolean }) => {
    let result = `[${error.code}] ${error.message}`;
    if (error.details) result += ` | Details: ${JSON.stringify(error.details)}`;
    if (error.retryable) result += ' (retryable)';
    return result;
  },
  isRetryable: (error: { retryable?: boolean }) => !!error.retryable,
};

describe('MCP Error Handler', () => {
  describe('Error Creation', () => {
    it('should create invalid_request error', () => {
      const error = mcpErrorHandler.invalidRequest('Missing parameter', { param: 'widget_id' });
      expect(error.code).toBe('invalid_request');
      expect(error.message).toBe('Missing parameter');
      expect(error.details).toEqual({ param: 'widget_id' });
      expect(error.retryable).toBe(false);
    });

    it('should create unauthorized error', () => {
      const error = mcpErrorHandler.unauthorized('Invalid API key');
      expect(error.code).toBe('unauthorized');
      expect(error.message).toBe('Invalid API key');
      expect(error.retryable).toBe(false);
    });

    it('should create unavailable error', () => {
      const error = mcpErrorHandler.unavailable('Service temporarily unavailable');
      expect(error.code).toBe('unavailable');
      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.retryable).toBe(true);
    });

    it('should create timeout error', () => {
      const error = mcpErrorHandler.timeout('Request timed out after 10s');
      expect(error.code).toBe('timeout');
      expect(error.message).toBe('Request timed out after 10s');
      expect(error.retryable).toBe(true);
    });

    it('should create command_failed error', () => {
      const error = mcpErrorHandler.commandFailed('Widget creation failed');
      expect(error.code).toBe('command_failed');
      expect(error.message).toBe('Widget creation failed');
      expect(error.retryable).toBe(false);
    });

    it('should create unknown error', () => {
      const error = mcpErrorHandler.unknown('Unexpected error');
      expect(error.code).toBe('unknown');
      expect(error.message).toBe('Unexpected error');
      expect(error.retryable).toBe(false);
    });
  });

  describe('Error from Generic Error', () => {
    it('should convert timeout error to BridgeError', () => {
      const error = mcpErrorHandler.fromError(new Error('Request timeout'));
      expect(error.code).toBe('timeout');
      expect(error.message).toBe('Request timeout');
    });

    it('should convert unauthorized error to BridgeError', () => {
      const error = mcpErrorHandler.fromError(new Error('Unauthorized access'));
      expect(error.code).toBe('unauthorized');
    });

    it('should convert permission error to unauthorized', () => {
      const error = mcpErrorHandler.fromError(new Error('Permission denied'));
      expect(error.code).toBe('unauthorized');
    });

    it('should convert invalid error to invalid_request', () => {
      const error = mcpErrorHandler.fromError(new Error('Invalid parameters'));
      expect(error.code).toBe('invalid_request');
    });

    it('should convert unknown error to unknown', () => {
      const error = mcpErrorHandler.fromError(new Error('Something went wrong'));
      expect(error.code).toBe('unknown');
    });
  });

  describe('Error Formatting', () => {
    it('should format error with code and message', () => {
      const error = mcpErrorHandler.invalidRequest('Missing param');
      const formatted = mcpErrorHandler.formatError(error);
      expect(formatted).toBe('[invalid_request] Missing param');
    });

    it('should format error with details', () => {
      const error = mcpErrorHandler.invalidRequest('Missing param', { param: 'id' });
      const formatted = mcpErrorHandler.formatError(error);
      expect(formatted).toContain('[invalid_request] Missing param');
      expect(formatted).toContain('Details: {"param":"id"}');
    });

    it('should mark retryable errors', () => {
      const error = mcpErrorHandler.unavailable('Service down');
      const formatted = mcpErrorHandler.formatError(error);
      expect(formatted).toContain('(retryable)');
    });

    it('should not mark non-retryable errors', () => {
      const error = mcpErrorHandler.invalidRequest('Bad request');
      const formatted = mcpErrorHandler.formatError(error);
      expect(formatted).not.toContain('(retryable)');
    });
  });

  describe('Retryable Check', () => {
    it('should identify retryable errors', () => {
      expect(mcpErrorHandler.isRetryable(mcpErrorHandler.timeout('timeout'))).toBe(true);
      expect(mcpErrorHandler.isRetryable(mcpErrorHandler.unavailable('unavailable'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(mcpErrorHandler.isRetryable(mcpErrorHandler.invalidRequest('invalid'))).toBe(false);
      expect(mcpErrorHandler.isRetryable(mcpErrorHandler.unauthorized('unauthorized'))).toBe(false);
      expect(mcpErrorHandler.isRetryable(mcpErrorHandler.commandFailed('failed'))).toBe(false);
    });
  });
});
