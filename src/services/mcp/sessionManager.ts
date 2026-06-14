import { WebSocket } from 'ws';
import { generateUUID } from '../../utils/uuid';

export interface Session {
  sessionId: string;
  token: string;
  createdAt: number;
  lastActivityAt: number;
  webSocket?: WebSocket;
  status: 'pending' | 'ready' | 'active' | 'closed';
  context: Record<string, unknown>;
}

export interface SessionEvent {
  type: 'session_ready' | 'session_closed' | 'command_received' | 'command_completed';
  sessionId: string;
  data?: unknown;
}

export interface CommandMessage {
  id: string;
  command: string;
  args?: Record<string, unknown>;
}

export interface CommandResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private commandQueue: Map<string, (response: CommandResponse) => void> = new Map();
  private defaultTimeout = 15000;
  private cleanupInterval = 60000;

  constructor() {
    this.startCleanupTimer();
  }

  createSession(): Session {
    const sessionId = generateUUID();
    const token = generateUUID();

    const session: Session = {
      sessionId,
      token,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      status: 'pending',
      context: {},
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.webSocket) {
      try {
        session.webSocket.close();
      } catch {
        // Ignore close errors
      }
    }
    this.sessions.delete(sessionId);
    this.emitEvent('session_closed', sessionId);
  }

  setWebSocket(sessionId: string, webSocket: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.webSocket = webSocket;
      session.status = 'ready';
      session.lastActivityAt = Date.now();
      
      this.setupWebSocketHandlers(sessionId, webSocket);
      this.sendSessionReady(sessionId);
      this.emitEvent('session_ready', sessionId);
    }
  }

  private setupWebSocketHandlers(sessionId: string, webSocket: WebSocket): void {
    webSocket.on('message', (data: Buffer) => this.handleMessage(sessionId, data));
    webSocket.on('close', () => this.handleClose(sessionId));
    webSocket.on('error', (error: Error) => this.handleError(sessionId, error));
  }

  private handleMessage(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = Date.now();

    try {
      const message = JSON.parse(data.toString()) as CommandMessage;
      this.emitEvent('command_received', sessionId, message);
      this.handleCommand(sessionId, message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(sessionId: string): void {
    this.removeSession(sessionId);
  }

  private handleError(sessionId: string, error: Error): void {
    console.error(`Session ${sessionId} error:`, error);
    this.removeSession(sessionId);
  }

  private handleCommand(sessionId: string, message: CommandMessage): void {
    const response: CommandResponse = {
      id: message.id,
      ok: true,
      data: { received: true },
    };

    this.sendResponse(sessionId, response);
    this.emitEvent('command_completed', sessionId, response);
  }

  sendResponse(sessionId: string, response: CommandResponse): void {
    const session = this.sessions.get(sessionId);
    if (session?.webSocket && session.webSocket.readyState === WebSocket.OPEN) {
      try {
        session.webSocket.send(JSON.stringify(response));
      } catch (error) {
        console.error('Failed to send response:', error);
      }
    }
  }

  private sendSessionReady(sessionId: string): void {
    const response: CommandResponse = {
      id: 'session_ready',
      ok: true,
      data: { sessionId, status: 'ready' },
    };
    this.sendResponse(sessionId, response);
  }

  sendCommand(sessionId: string, command: string, args?: Record<string, unknown>): Promise<CommandResponse> {
    return new Promise((resolve, reject) => {
      const commandId = generateUUID();
      const timeoutId = setTimeout(() => {
        this.commandQueue.delete(commandId);
        reject(new Error('Command timeout'));
      }, this.defaultTimeout);

      this.commandQueue.set(commandId, (response) => {
        clearTimeout(timeoutId);
        this.commandQueue.delete(commandId);
        resolve(response);
      });

      const message: CommandMessage = { id: commandId, command, args };
      this.sendResponse(sessionId, message as unknown as CommandResponse);
    });
  }

  updateContext(sessionId: string, context: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...context };
      session.lastActivityAt = Date.now();
    }
  }

  getContext(sessionId: string): Record<string, unknown> {
    return this.sessions.get(sessionId)?.context || {};
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active' || s.status === 'ready');
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 15 * 60 * 1000;

      for (const [sessionId, session] of this.sessions) {
        if (now - session.lastActivityAt > timeout) {
          this.removeSession(sessionId);
        }
      }
    }, this.cleanupInterval);
  }

  private emitEvent(type: SessionEvent['type'], sessionId: string, data?: unknown): void {
    console.debug(`Session event: ${type} - ${sessionId}`, data);
  }

  isConnected(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.webSocket?.readyState === WebSocket.OPEN;
  }

  closeSession(sessionId: string): void {
    this.removeSession(sessionId);
  }
}

export const sessionManager = new SessionManager();