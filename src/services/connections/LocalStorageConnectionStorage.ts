import { generateUUID } from '../../utils/uuid';
import type { Connection } from '../../types/connections';
import type { IConnectionStorage } from './IConnectionStorage';

const STORAGE_KEY = 'finanalyzer_connections';

export class LocalStorageConnectionStorage implements IConnectionStorage {
  getConnections(): Connection[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting connections:', error);
      return [];
    }
  }

  getConnection(id: string): Connection | undefined {
    try {
      const connections = this.getConnections();
      return connections.find((conn) => conn.id === id);
    } catch (error) {
      console.error('Error getting connection:', error);
      return undefined;
    }
  }

  createConnection(
    connection: Omit<
      Connection,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'
    >,
  ): Connection {
    try {
      const newConnection: Connection = {
        ...connection,
        id: generateUUID(),
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

      const connections = this.getConnections();
      connections.push(newConnection);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));

      return newConnection;
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  }

  updateConnection(id: string, updates: Partial<Connection>): Connection | undefined {
    try {
      const connections = this.getConnections();
      const index = connections.findIndex((conn) => conn.id === id);

      if (index === -1) {
        return undefined;
      }

      connections[index] = {
        ...connections[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
      return connections[index];
    } catch (error) {
      console.error('Error updating connection:', error);
      return undefined;
    }
  }

  deleteConnection(id: string): boolean {
    try {
      const connections = this.getConnections();
      const newConnections = connections.filter((conn) => conn.id !== id);

      if (newConnections.length === connections.length) {
        return false;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConnections));
      return true;
    } catch (error) {
      console.error('Error deleting connection:', error);
      return false;
    }
  }

  getStorageType(): 'localstorage' | 'keepass' {
    return 'localstorage';
  }

  isAvailable(): boolean {
    try {
      const testKey = '__finanalyzer_storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}