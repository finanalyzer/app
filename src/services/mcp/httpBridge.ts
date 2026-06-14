import type { Request, Response } from 'express';
import { sessionManager } from './sessionManager';
import type { Session } from './sessionManager';
import { createErrorHandler } from './errorHandler';

export interface SessionStartResponse {
  sessionId: string;
  token: string;
  websocketUrl: string;
  expiresAt: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  sessions: number;
  activeSessions: number;
  timestamp: number;
}

export interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class HttpBridge {
  startSession(_req: Request, res: Response): void {
    const session = sessionManager.createSession();
    
    const response: SessionStartResponse = {
      sessionId: session.sessionId,
      token: session.token,
      websocketUrl: `ws://localhost:8787/ws/${session.sessionId}`,
      expiresAt: session.createdAt + 15 * 60 * 1000,
    };

    res.status(200).json(response);
  }

  getHealth(_req: Request, res: Response): void {
    const sessionCount = sessionManager.getSessionCount();
    const activeSessions = sessionManager.getActiveSessions().length;
    
    let status: HealthResponse['status'] = 'healthy';
    if (sessionCount > 100) {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      sessions: sessionCount,
      activeSessions,
      timestamp: Date.now(),
    };

    res.status(200).json(response);
  }

  getSessionInfo(req: Request, res: Response): void {
    const sessionId = req.params.sessionId as string;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const response: Partial<Session> = {
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      context: session.context,
    };

    res.status(200).json(response);
  }

  closeSession(req: Request, res: Response): void {
    const sessionId = req.params.sessionId as string;
    sessionManager.closeSession(sessionId);
    res.status(200).json({ success: true, message: 'Session closed' });
  }

  handleWebSocketUpgrade(sessionId: string, _upgradeHeader: string): boolean {
    const session = sessionManager.getSession(sessionId);
    return session?.status === 'pending' || session?.status === 'ready';
  }

  async handleJsonRpcRequest(req: Request, res: Response): Promise<void> {
    const errorHandler = createErrorHandler();
    
    try {
      const body: JsonRpcRequest = req.body;
      
      if (!body.jsonrpc || body.jsonrpc !== '2.0') {
        const error = errorHandler.handleInvalidRequest('Invalid JSON-RPC version');
        res.status(400).json(error);
        return;
      }

      if (!body.method || typeof body.method !== 'string') {
        const error = errorHandler.handleInvalidRequest('Method is required');
        res.status(400).json(error);
        return;
      }

      errorHandler.setRequestId(String(body.id));

      const response = await this.routeJsonRpcRequest(body);
      res.status(200).json(response);
    } catch (error) {
      const errorResponse = errorHandler.wrapError(error);
      res.status(500).json(errorResponse);
    }
  }

  private async routeJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    try {
      switch (method) {
        case 'bridge.session.start':
          return this.handleSessionStart(params);
        case 'bridge.session.close':
          return this.handleSessionClose(params);
        case 'bridge.session.get':
          return this.handleSessionGet(params);
        case 'bridge.command.execute':
          return this.handleCommandExecute(params);
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private handleSessionStart(_params?: unknown): JsonRpcResponse {
    const session = sessionManager.createSession();
    
    return {
      jsonrpc: '2.0',
      id: null,
      result: {
        sessionId: session.sessionId,
        token: session.token,
        websocketUrl: `ws://localhost:8787/ws/${session.sessionId}`,
        expiresAt: session.createdAt + 15 * 60 * 1000,
      },
    };
  }

  private handleSessionClose(params?: unknown): JsonRpcResponse {
    const sessionId = (params as Record<string, unknown>)?.sessionId as string;
    
    if (!sessionId) {
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32602,
          message: 'sessionId is required',
        },
      };
    }

    sessionManager.closeSession(sessionId);
    
    return {
      jsonrpc: '2.0',
      id: null,
      result: { success: true },
    };
  }

  private handleSessionGet(params?: unknown): JsonRpcResponse {
    const sessionId = (params as Record<string, unknown>)?.sessionId as string;
    
    if (!sessionId) {
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32602,
          message: 'sessionId is required',
        },
      };
    }

    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32601,
          message: 'Session not found',
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: null,
      result: {
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
      },
    };
  }

  private async handleCommandExecute(params?: unknown): Promise<JsonRpcResponse> {
    const sessionId = (params as Record<string, unknown>)?.sessionId as string;
    const command = (params as Record<string, unknown>)?.command as string;
    const args = (params as Record<string, unknown>)?.args as Record<string, unknown>;

    if (!sessionId || !command) {
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32602,
          message: 'sessionId and command are required',
        },
      };
    }

    try {
      const response = await sessionManager.sendCommand(sessionId, command, args);
      
      return {
        jsonrpc: '2.0',
        id: null,
        result: response,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32002,
          message: error instanceof Error ? error.message : 'Command execution failed',
        },
      };
    }
  }

  handleSseStream(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sessionId = req.params.sessionId as string;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      res.write('event: error\ndata: {"error": "Session not found"}\n\n');
      res.end();
      return;
    }

    const sendMessage = (eventType: string, data: unknown) => {
      const payload = JSON.stringify(data);
      res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
    };

    sendMessage('session_status', {
      sessionId: session.sessionId,
      status: session.status,
    });

    const intervalId = setInterval(() => {
      res.write('event: ping\ndata: {}\n\n');
    }, 10000);

    req.on('close', () => {
      clearInterval(intervalId);
    });
  }
}

export const httpBridge = new HttpBridge();