import type { BridgeError, WorkspaceCommandResult } from '../../types/mcp/models';

export interface ToolResponse {
  ok: boolean;
  command: string;
  request_id: string | null;
  message: string;
  data: unknown | null;
  error: BridgeError | null;
}

export class ResponseFormatter {
  success(command: string, requestId: string | null, message: string, data?: unknown): ToolResponse {
    return {
      ok: true,
      command,
      request_id: requestId,
      message,
      data: data ?? null,
      error: null,
    };
  }

  error(command: string, requestId: string | null, error: BridgeError): ToolResponse {
    return {
      ok: false,
      command,
      request_id: requestId,
      message: error.message,
      data: null,
      error,
    };
  }

  fromCommandResult(result: WorkspaceCommandResult): ToolResponse {
    return {
      ok: result.ok,
      command: result.command,
      request_id: result.request_id ?? null,
      message: result.message,
      data: result.data ?? null,
      error: result.error ?? null,
    };
  }

  formatData(data: unknown): unknown {
    if (data === undefined) {
      return null;
    }
    if (typeof data === 'object' && data !== null) {
      return JSON.parse(JSON.stringify(data));
    }
    return data;
  }

  serialize(response: ToolResponse): string {
    return JSON.stringify(response);
  }

  deserialize(json: string): ToolResponse {
    try {
      return JSON.parse(json);
    } catch {
      throw new Error('Invalid ToolResponse JSON');
    }
  }
}

export const responseFormatter = new ResponseFormatter();
