export type McpErrorCode =
  | 'invalid_request'
  | 'invalid_parameter'
  | 'not_found'
  | 'permission_denied'
  | 'internal_error'
  | 'service_unavailable'
  | 'timeout'
  | 'rate_limit_exceeded'
  | 'not_implemented'
  | 'validation_failed';

export interface McpError {
  code: McpErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ErrorResponse {
  jsonrpc: string;
  id: string | null;
  error: McpError;
}

export class McpErrorHandler {
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || 'unknown';
  }

  createError(code: McpErrorCode, message: string, details?: Record<string, unknown>): ErrorResponse {
    return {
      jsonrpc: '2.0',
      id: this.requestId,
      error: {
        code,
        message,
        details,
        requestId: this.requestId,
      },
    };
  }

  handleInvalidRequest(message?: string): ErrorResponse {
    return this.createError('invalid_request', message || 'Invalid request');
  }

  handleInvalidParameter(parameter: string, reason?: string): ErrorResponse {
    return this.createError('invalid_parameter', `Invalid parameter: ${parameter}`, { parameter, reason });
  }

  handleNotFound(resource: string, identifier?: string): ErrorResponse {
    const message = identifier ? `${resource} not found: ${identifier}` : `${resource} not found`;
    return this.createError('not_found', message, { resource, identifier });
  }

  handlePermissionDenied(message?: string): ErrorResponse {
    return this.createError('permission_denied', message || 'Permission denied');
  }

  handleInternalError(error: Error): ErrorResponse {
    console.error('Internal error:', error);
    return this.createError('internal_error', 'Internal server error', {
      stack: error.stack,
      name: error.name,
    });
  }

  handleServiceUnavailable(message?: string): ErrorResponse {
    return this.createError('service_unavailable', message || 'Service unavailable');
  }

  handleTimeout(message?: string): ErrorResponse {
    return this.createError('timeout', message || 'Request timeout');
  }

  handleRateLimitExceeded(retryAfter?: number): ErrorResponse {
    const details: Record<string, unknown> = {};
    if (retryAfter !== undefined) {
      details.retryAfter = retryAfter;
    }
    return this.createError('rate_limit_exceeded', 'Rate limit exceeded', details);
  }

  handleNotImplemented(method?: string): ErrorResponse {
    const message = method ? `Method not implemented: ${method}` : 'Method not implemented';
    return this.createError('not_implemented', message, { method });
  }

  handleValidationFailed(errors: Record<string, string>): ErrorResponse {
    return this.createError('validation_failed', 'Validation failed', { errors });
  }

  wrapError(error: unknown): ErrorResponse {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return this.handleNotFound('resource');
      }
      if (error.message.includes('timeout')) {
        return this.handleTimeout();
      }
      if (error.message.includes('permission')) {
        return this.handlePermissionDenied();
      }
      return this.handleInternalError(error);
    }
    return this.handleInternalError(new Error(String(error)));
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }
}

export function createErrorHandler(requestId?: string): McpErrorHandler {
  return new McpErrorHandler(requestId);
}