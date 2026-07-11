import type { Connection } from '../../types/connections';
import type { IConnectionStorage } from './IConnectionStorage';

export class KeePassConnectionStorage implements IConnectionStorage {
  getConnections(): Connection[] {
    console.warn('KeePassConnectionStorage.getConnections() not implemented');
    return [];
  }

  getConnection(_id: string): Connection | undefined {
    console.warn('KeePassConnectionStorage.getConnection() not implemented');
    return undefined;
  }

  createConnection(
    connection: Omit<
      Connection,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'
    >,
  ): Connection {
    console.warn('KeePassConnectionStorage.createConnection() not implemented');
    return {
      ...connection,
      id: `kp-${Date.now()}`,
      status: 'disconnected',
      metrics: {
        apps: 0,
        widgets: 0,
        prompts: 0,
        agents: 0,
      },
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  updateConnection(_id: string, _updates: Partial<Connection>): Connection | undefined {
    console.warn('KeePassConnectionStorage.updateConnection() not implemented');
    return undefined;
  }

  deleteConnection(_id: string): boolean {
    console.warn('KeePassConnectionStorage.deleteConnection() not implemented');
    return false;
  }

  getStorageType(): 'localstorage' | 'keepass' {
    return 'keepass';
  }

  isAvailable(): boolean {
    const token = localStorage.getItem('passxyz-token');
    return !!token;
  }
}