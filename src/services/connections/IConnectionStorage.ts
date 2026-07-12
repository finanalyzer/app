import type { Connection } from '../../types/connections';

export interface IConnectionStorage {
  getConnections(): Connection[];
  getConnection(id: string): Connection | undefined;
  
  createConnectionAsync(
    connection: Omit<
      Connection,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'
    >,
  ): Promise<Connection>;
  updateConnectionAsync(id: string, updates: Partial<Connection>): Promise<Connection | undefined>;
  deleteConnectionAsync(id: string): Promise<boolean>;
  
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
  
  initialize?(): Promise<void>;
}