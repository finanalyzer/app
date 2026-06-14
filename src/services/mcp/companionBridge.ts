import { commandHandler } from './commandHandler';

/**
 * Companion Bridge — browser-side WebSocket connection to the workspace-mcp sidecar.
 *
 * Implements the same protocol as OpenBB Workspace's MCP Companion:
 *   1. POST /bridge/session/start  →  get session + websocket_url
 *   2. Connect WebSocket to websocket_url with session_id & token
 *   3. Handle command_request from sidecar, respond with command_result
 *   4. Handle ping → pong keepalive
 *
 * Usage:
 *   const bridge = new CompanionBridge();
 *   await bridge.connect('http://127.0.0.1:8787');
 *   // bridge.isConnected() === true
 *   bridge.disconnect();
 */

export type BridgeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BridgeSession {
  sessionId: string;
  token: string;
  clientName: string;
  currentDashboardId?: string;
  currentTabId?: string;
}

export interface CompanionEvent {
  type: string;
  payload: Record<string, unknown>;
}

type CommandRequestHandler = (command: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class CompanionBridge {
  private ws: WebSocket | null = null;
  private baseUrl = '';
  private _session: BridgeSession | null = null;
  private _status: BridgeConnectionStatus = 'disconnected';
  private eventListeners = new Set<(event: CompanionEvent) => void>();
  /** Callers can set this to handle incoming command_request messages */
  onCommandRequest: CommandRequestHandler | null = null;

  get status(): BridgeConnectionStatus {
    return this._status;
  }

  get session(): BridgeSession | null {
    return this._session;
  }

  get connected(): boolean {
    return this._status === 'connected' && this.ws !== null;
  }

  /** Start a bridge session and connect the WebSocket. */
  async connect(sidecarUrl: string): Promise<BridgeSession> {
    this.disconnect();
    this._status = 'connecting';
    this.baseUrl = sidecarUrl.replace(/\/+$/, '');

    try {
      // Step 1: call /bridge/session/start
      const sessionStartResponse = await this.startSession();
      const { session, websocket_url: websocketUrl } = sessionStartResponse;

      // Step 2: connect WebSocket
      this._session = session;
      await this.connectWebSocket(websocketUrl);

      this._status = 'connected';
      this.notify({ type: 'connected', payload: { sessionId: session.sessionId } });
      return session;
    } catch (error) {
      this._status = 'error';
      this._session = null;
      const message = error instanceof Error ? error.message : 'Connection failed';
      this.notify({ type: 'error', payload: { error: message } });
      throw error;
    }
  }

  /** Disconnect the WebSocket and clear the session. */
  disconnect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this._session = null;
    this._status = 'disconnected';
    this.notify({ type: 'disconnected', payload: {} });
  }

  /** Send a session_context_changed message to the sidecar. */
  sendContextChange(context: { currentDashboardId?: string; currentTabId?: string }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'session_context_changed',
      session: {
        current_dashboard_id: context.currentDashboardId ?? null,
        current_tab_id: context.currentTabId ?? null,
      },
    }));
  }

  /** Subscribe to lifecycle events. Returns unsubscribe function. */
  subscribe(listener: (event: CompanionEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async startSession(): Promise<{ session: BridgeSession; websocket_url: string }> {
    const response = await fetch(`${this.baseUrl}/bridge/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'finanalyzer-app' }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to start bridge session: ${response.status} ${text}`);
    }
    const data = await response.json() as {
      session: {
        session_id: string;
        token: string;
        client_name: string;
        current_dashboard_id?: string;
        current_tab_id?: string;
      };
      websocket_url: string;
    };
    return {
      session: {
        sessionId: data.session.session_id,
        token: data.session.token,
        clientName: data.session.client_name,
        currentDashboardId: data.session.current_dashboard_id,
        currentTabId: data.session.current_tab_id,
      },
      websocket_url: data.websocket_url,
    };
  }

  private connectWebSocket(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
          // Wait for session_ready before resolving
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch {
            // ignore malformed messages
          }
        };

        ws.onerror = () => {
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          if (this._status === 'connected') {
            this._status = 'disconnected';
            this.notify({ type: 'disconnected', payload: {} });
          }
        };

        // Listen for session_ready to resolve
        const readyHandler = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'session_ready') {
              ws.removeEventListener('message', readyHandler);
              resolve();
            }
          } catch { /* ignore */ }
        };
        ws.addEventListener('message', readyHandler);

        // Timeout
        setTimeout(() => {
          ws.removeEventListener('message', readyHandler);
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timed out'));
          } else {
            resolve();
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleServerMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
    switch (message.type) {
      case 'session_ready':
        // Already handled in connectWebSocket
        break;

      case 'command_request': {
        const command = message.command as Record<string, unknown>;
        const requestId = (command.request_id ?? null) as string | null;
        let result: Record<string, unknown>;

        try {
          if (this.onCommandRequest) {
            const data = await this.onCommandRequest(command);
            result = {
              ok: true,
              command: command.command,
              request_id: requestId,
              message: 'ok',
              data,
              error: null,
            };
          } else {
            result = {
              ok: false,
              command: command.command,
              request_id: requestId,
              message: 'No command handler registered',
              data: null,
              error: {
                code: 'command_failed',
                message: `Command '${String(command.command)}' is not handled by the companion bridge`,
                retryable: false,
              },
            };
          }
        } catch (error) {
          result = {
            ok: false,
            command: command.command,
            request_id: requestId,
            message: error instanceof Error ? error.message : 'Command execution failed',
            data: null,
            error: {
              code: 'command_failed',
              message: error instanceof Error ? error.message : 'Command execution failed',
              retryable: false,
            },
          };
        }

        this.sendCommandResult(result);
        break;
      }

      case 'ping':
        this.sendPong();
        break;

      case 'pong':
        // Ignore pongs from server
        break;

      case 'error':
        this.notify({ type: 'server_error', payload: (message.error ?? {}) as Record<string, unknown> });
        break;

      default:
        this.notify({ type: message.type, payload: message as Record<string, unknown> });
        break;
    }
  }

  private sendCommandResult(result: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'command_result',
      result,
    }));
  }

  private sendPong(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'pong' }));
  }

  private notify(event: CompanionEvent): void {
    this.eventListeners.forEach((fn) => fn(event));
  }
}

/** Singleton instance for app-wide use. */
export const companionBridge = new CompanionBridge();

/** Connect commandHandler to handle incoming MCP commands */
companionBridge.onCommandRequest = async (command) => {
  const sessionId = companionBridge.session?.sessionId || '';

  // Extract standard fields from command object
  // workspace-mcp sends params in different formats depending on command type:
  // - Most commands: { command, request_id, origin, backend_id, widget_id, ... }
  // - get_widget_data: { command, request_id, data_sources: [{ origin, widget_id, ... }] }
  // - get_params_options: { command, request_id, param_options_queries: [{ ... }] }
  const { command: cmd, request_id, ...rawArgs } = command as Record<string, unknown>;

  // Map workspace-mcp command names to commandHandler expected names
  const commandNameMap: Record<string, string> = {
    'update_dashboard_layout': 'update_widget_layout',
  };
  const mappedCmd = commandNameMap[cmd as string] || (cmd as string);

  // Handle data_sources array (used by get_widget_data)
  // Extract first element's fields as top-level args
  // workspace-mcp transforms fields: widget_id -> id, data_args -> input_args
  let args: Record<string, unknown>;
  if (rawArgs.data_sources && Array.isArray(rawArgs.data_sources) && rawArgs.data_sources.length > 0) {
    const dataSource = rawArgs.data_sources[0] as Record<string, unknown>;
    // Map workspace-mcp field names to commandHandler expected names
    args = {
      ...dataSource,
      widget_id: dataSource.id ?? dataSource.widget_id,  // id -> widget_id
      data_args: dataSource.input_args ?? dataSource.data_args,  // input_args -> data_args
    };
    // Remove old field names if present
    delete (args as Record<string, unknown>).id;
    delete (args as Record<string, unknown>).input_args;
  } else if (rawArgs.param_options_queries && Array.isArray(rawArgs.param_options_queries) && rawArgs.param_options_queries.length > 0) {
    const query = rawArgs.param_options_queries[0] as Record<string, unknown>;
    // Map workspace-mcp field names to commandHandler expected names
    args = {
      ...query,
      widget_id: query.id ?? query.widget_id,  // id -> widget_id
      param_name: query.param ?? query.param_name,  // param -> param_name
      data_args: query.options_endpoint_input_args ?? query.data_args,  // options_endpoint_input_args -> data_args
    };
    // Remove old field names if present
    delete (args as Record<string, unknown>).id;
    delete (args as Record<string, unknown>).param;
    delete (args as Record<string, unknown>).options_endpoint_input_args;
  } else {
    // Strip null/undefined values to avoid downstream issues with null checks
    args = Object.fromEntries(
      Object.entries(rawArgs).filter(([, v]) => v != null)
    );

    // Map workspace-mcp field names to commandHandler expected names:
    // - backend_name → origin (create_widget, update_widget, read_widget, get_widget_schema, get_widget_data)
    // - config.data_args → data_args (create_widget, update_widget)
    // - config.ui_args → ui_args (create_widget, update_widget)
    if (args.backend_name !== undefined) {
      args.origin = args.backend_name;
      delete args.backend_name;
    }

    // Unwrap config.data_args and config.ui_args for create_widget / update_widget
    if (args.config && typeof args.config === 'object') {
      const config = args.config as Record<string, unknown>;
      if (config.data_args !== undefined && config.data_args !== null) {
        args.data_args = config.data_args;
      }
      if (config.ui_args !== undefined && config.ui_args !== null) {
        args.ui_args = config.ui_args;
      }
      delete args.config;
    }
  }

  const response = await commandHandler.handleCommand(
    sessionId,
    { id: request_id as string || '', command: mappedCmd, args }
  );

  if (!response.ok) {
    throw new Error(response.error?.message || 'Command failed');
  }

  return response.data as Record<string, unknown>;
};
