import type { Connection } from '../../types/connections';

export interface IConnectionStorage {
  getConnections(): Connection[];
  getConnection(id: string): Connection | undefined;
  createConnection(
    connection: Omit<
      Connection,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'
    >,
  ): Connection;
  updateConnection(id: string, updates: Partial<Connection>): Connection | undefined;
  deleteConnection(id: string): boolean;
  getStorageType(): 'localstorage' | 'keepass';
  isAvailable(): boolean;
}