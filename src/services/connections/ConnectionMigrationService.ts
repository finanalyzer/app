import type { Connection } from '../../types/connections';

const STORAGE_KEY = 'finanalyzer_connections';
const MIGRATION_FLAG_KEY = 'finanalyzer_migration_completed';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors: string[];
}

export class ConnectionMigrationService {
  static needsMigration(): boolean {
    const migrationCompleted = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrationCompleted === 'true') {
      return false;
    }

    const storedConnections = localStorage.getItem(STORAGE_KEY);
    return !!storedConnections;
  }

  static getLocalStorageConnections(): Connection[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static async migrate(
    createConnection: (connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'>) => Promise<Connection>
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const localStorageConnections = this.getLocalStorageConnections();
    if (localStorageConnections.length === 0) {
      this.setMigrationCompleted();
      return result;
    }

    for (const connection of localStorageConnections) {
      try {
        const connectionData: Omit<Connection, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'> = {
          name: connection.name,
          url: connection.url,
          apiKey: connection.apiKey,
          apiSecret: connection.apiSecret,
          description: connection.description,
          validateWidgets: connection.validateWidgets,
          authType: connection.authType,
          authentication: connection.authentication,
        };

        await createConnection(connectionData);
        result.migratedCount++;
      } catch (error) {
        result.success = false;
        result.failedCount++;
        result.errors.push(
          error instanceof Error ? error.message : `Failed to migrate connection: ${connection.name}`
        );
        console.error(`Failed to migrate connection: ${connection.name}`, error);
      }
    }

    if (result.success || result.migratedCount > 0) {
      this.setMigrationCompleted();
    }

    return result;
  }

  static clearLocalStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  static setMigrationCompleted(): void {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  }

  static resetMigrationFlag(): void {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  }

  static isMigrationCompleted(): boolean {
    return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  }
}