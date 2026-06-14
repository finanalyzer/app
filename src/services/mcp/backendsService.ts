export type BackendType = 'openbb' | 'custom';

export type BackendStatus = 'connected' | 'disconnected' | 'error';

export interface BackendConnection {
  id: string;
  name: string;
  type: BackendType;
  endpoint: string;
  headers: Record<string, string>;
  enabled: boolean;
  lastConnectedAt?: number;
  status: BackendStatus;
  errorMessage?: string;
}

export interface BackendSummary {
  id: string;
  name: string;
  type: BackendType;
  status: BackendStatus;
}

export class BackendsService {
  private backends: Map<string, BackendConnection> = new Map();

  constructor() {
    this.initializeDefaultBackends();
  }

  private initializeDefaultBackends(): void {
    const defaultBackend: BackendConnection = {
      id: 'openbb-default',
      name: 'OpenBB Default',
      type: 'openbb',
      endpoint: '/api/v1',
      headers: {},
      enabled: true,
      status: 'connected',
      lastConnectedAt: Date.now(),
    };
    this.backends.set(defaultBackend.id, defaultBackend);
  }

  listBackends(): BackendConnection[] {
    return Array.from(this.backends.values());
  }

  listBackendSummaries(): BackendSummary[] {
    return Array.from(this.backends.values()).map((backend) => ({
      id: backend.id,
      name: backend.name,
      type: backend.type,
      status: backend.status,
    }));
  }

  getBackend(id: string): BackendConnection | undefined {
    return this.backends.get(id);
  }

  addBackend(backendData: Omit<BackendConnection, 'id' | 'status' | 'lastConnectedAt' | 'errorMessage'>): BackendConnection {
    const newBackend: BackendConnection = {
      ...backendData,
      id: `backend-${Date.now()}`,
      status: 'disconnected',
    };

    this.backends.set(newBackend.id, newBackend);
    return newBackend;
  }

  updateBackend(id: string, updates: Partial<Omit<BackendConnection, 'id' | 'status' | 'lastConnectedAt'>>): BackendConnection | undefined {
    const existing = this.backends.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: BackendConnection = {
      ...existing,
      ...updates,
    };

    this.backends.set(id, updated);
    return updated;
  }

  async refreshBackend(id: string): Promise<BackendConnection | undefined> {
    const backend = this.backends.get(id);
    if (!backend) {
      return undefined;
    }

    try {
      const response = await fetch(backend.endpoint, {
        method: 'GET',
        headers: { ...backend.headers },
      });

      if (response.ok) {
        backend.status = 'connected';
        backend.lastConnectedAt = Date.now();
        backend.errorMessage = undefined;
      } else {
        backend.status = 'error';
        backend.errorMessage = `HTTP ${response.status}`;
      }
    } catch (error) {
      backend.status = 'error';
      backend.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    this.backends.set(id, backend);
    return backend;
  }

  removeBackend(id: string): boolean {
    return this.backends.delete(id);
  }

  toggleBackend(id: string): BackendConnection | undefined {
    const backend = this.backends.get(id);
    if (!backend) {
      return undefined;
    }

    backend.enabled = !backend.enabled;
    if (!backend.enabled) {
      backend.status = 'disconnected';
    }

    this.backends.set(id, backend);
    return backend;
  }

  getBackendCount(): number {
    return this.backends.size;
  }

  getEnabledBackends(): BackendConnection[] {
    return Array.from(this.backends.values()).filter((b) => b.enabled);
  }

  getStatusCounts(): Record<BackendStatus, number> {
    const counts: Record<BackendStatus, number> = {
      connected: 0,
      disconnected: 0,
      error: 0,
    };

    this.backends.forEach((backend) => {
      counts[backend.status]++;
    });

    return counts;
  }
}

export const backendsService = new BackendsService();