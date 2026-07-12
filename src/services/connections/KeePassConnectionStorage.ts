import { generateUUID } from '../../utils/uuid';
import type { Connection } from '../../types/connections';
import type { IConnectionStorage } from './IConnectionStorage';
import { ConnectionMigrationService } from './ConnectionMigrationService';

const FINANALYZER_GROUP_NAME = 'finanalyzer';
const CUSTOM_FIELD_PREFIX = 'finanalyzer_';

const ItemSubType = {
  Group: 0,
  Entry: 1,
  Notes: 2,
  PxEntry: 3,
  None: 4,
} as const;

interface KeePassItem {
  id: string;
  name: string;
  type: number;
  isGroup: boolean;
  lastModified: string;
  icon?: string;
  iconContentType?: string;
  description?: string;
  notes?: string;
  username?: string;
  password?: string;
  url?: string;
  email?: string;
  mobile?: string;
  otpUrl?: string;
  customFields?: Record<string, string>;
  fields?: Array<{
    key?: string;
    value?: string;
    isProtected?: boolean;
    isBinary?: boolean;
    encodedKey?: string;
  }>;
  groupId?: string;
}

export class KeePassConnectionStorage implements IConnectionStorage {
  private cache: Map<string, Connection> = new Map();
  private finanalyzerGroupId: string | null = null;
  private entryIdMap: Map<string, string> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[KeePassConnectionStorage] initialize() called');
      this.finanalyzerGroupId = await this.ensureFinanalyzerGroup();
      console.log(`[KeePassConnectionStorage] finanalyzerGroupId: ${this.finanalyzerGroupId}`);
      await this.fetchConnections();
      console.log(`[KeePassConnectionStorage] Initial connections loaded: ${this.cache.size}`);

      if (ConnectionMigrationService.needsMigration()) {
        console.log('[KeePassConnectionStorage] Migration needed, starting migration from localStorage');
        const migrationResult = await ConnectionMigrationService.migrate(
          (connectionData) => this.createConnectionAsync(connectionData)
        );
        console.log(`[KeePassConnectionStorage] Migration completed: ${migrationResult.migratedCount} migrated, ${migrationResult.failedCount} failed`);
        
        if (migrationResult.errors.length > 0) {
          console.error('[KeePassConnectionStorage] Migration errors:', migrationResult.errors);
        }

        await this.fetchConnections();
        console.log(`[KeePassConnectionStorage] Connections after migration: ${this.cache.size}`);
      }

      this.isInitialized = true;
      console.log('[KeePassConnectionStorage] initialize() completed successfully');
    } catch (error) {
      console.error('[KeePassConnectionStorage] Failed to initialize KeePass connection storage:', error);
      throw error;
    }
  }

  getConnections(): Connection[] {
    return Array.from(this.cache.values());
  }

  getConnection(id: string): Connection | undefined {
    return this.cache.get(id);
  }

  async createConnectionAsync(
    connection: Omit<
      Connection,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'
    >,
  ): Promise<Connection> {
    if (!this.finanalyzerGroupId) {
      throw new Error('KeePass storage not initialized');
    }

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

    const entryId = await this.createEntry(newConnection);
    
    this.cache.set(newConnection.id, newConnection);
    this.entryIdMap.set(newConnection.id, entryId);

    return newConnection;
  }

  async updateConnectionAsync(id: string, updates: Partial<Connection>): Promise<Connection | undefined> {
    const existingConnection = this.cache.get(id);
    if (!existingConnection) {
      return undefined;
    }

    const entryId = this.entryIdMap.get(id);
    if (!entryId) {
      return undefined;
    }

    const updatedConnection: Connection = {
      ...existingConnection,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.updateEntry(entryId, updatedConnection);
    
    this.cache.set(id, updatedConnection);

    return updatedConnection;
  }

  async deleteConnectionAsync(id: string): Promise<boolean> {
    const entryId = this.entryIdMap.get(id);
    if (!entryId) {
      return false;
    }

    await this.deleteEntry(entryId);
    
    this.cache.delete(id);
    this.entryIdMap.delete(id);

    return true;
  }

  createConnection(
    connection: Omit<
      Connection,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'metrics' | 'lastActivity'
    >,
  ): Connection {
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

    this.cache.set(newConnection.id, newConnection);
    
    this.createEntry(newConnection).then((entryId) => {
      this.entryIdMap.set(newConnection.id, entryId);
    }).catch(console.error);

    return newConnection;
  }

  updateConnection(id: string, updates: Partial<Connection>): Connection | undefined {
    const existingConnection = this.cache.get(id);
    if (!existingConnection) {
      return undefined;
    }

    const updatedConnection: Connection = {
      ...existingConnection,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(id, updatedConnection);
    
    const entryId = this.entryIdMap.get(id);
    if (entryId) {
      this.updateEntry(entryId, updatedConnection).catch(console.error);
    }

    return updatedConnection;
  }

  deleteConnection(id: string): boolean {
    const entryId = this.entryIdMap.get(id);
    if (!entryId) {
      return false;
    }

    this.cache.delete(id);
    this.entryIdMap.delete(id);
    
    this.deleteEntry(entryId).catch(console.error);

    return true;
  }

  getStorageType(): 'localstorage' | 'keepass' {
    return 'keepass';
  }

  isAvailable(): boolean {
    const token = localStorage.getItem('passxyz-token');
    return !!token;
  }

  private async ensureFinanalyzerGroup(): Promise<string> {
    try {
      console.log('[KeePassConnectionStorage] ensureFinanalyzerGroup() called');
      const rootItems = await this.apiGet<KeePassItem[]>(`/api/vault/groups/root/items`);
      console.log(`[KeePassConnectionStorage] Root items fetched: ${rootItems.length} items`);
      const finanalyzerGroup = rootItems.find(
        (item) => item.isGroup && item.name === FINANALYZER_GROUP_NAME
      );

      if (finanalyzerGroup) {
        console.log(`[KeePassConnectionStorage] Found existing finanalyzer group with id: ${finanalyzerGroup.id}`);
        return finanalyzerGroup.id;
      }

      console.log('[KeePassConnectionStorage] Creating new finanalyzer group');
      const createdGroup = await this.apiPost<KeePassItem>(
        `/api/vault/groups/root/groups`,
        { name: FINANALYZER_GROUP_NAME }
      );
      console.log(`[KeePassConnectionStorage] Created finanalyzer group with id: ${createdGroup.id}`);

      return createdGroup.id;
    } catch (error) {
      console.error('[KeePassConnectionStorage] Failed to ensure finanalyzer group:', error);
      throw error;
    }
  }

  private async fetchConnections(): Promise<void> {
    if (!this.finanalyzerGroupId) {
      return;
    }

    try {
      console.log(`[KeePassConnectionStorage] fetchConnections() called for group: ${this.finanalyzerGroupId}`);
      const items = await this.apiGet<KeePassItem[]>(
        `/api/vault/groups/${this.finanalyzerGroupId}/items`
      );
      console.log(`[KeePassConnectionStorage] Items fetched from group: ${items.length}`);

      this.cache.clear();
      this.entryIdMap.clear();

      for (const item of items) {
        console.log(`[KeePassConnectionStorage] Item: id=${item.id}, name=${item.name}, type=${item.type}, isGroup=${item.isGroup}`);
        
        if (item.isGroup) {
          continue;
        }

        try {
          const fullEntry = await this.apiGet<KeePassItem>(`/api/vault/entries/${item.id}`);
          console.log(`[KeePassConnectionStorage] Full entry customFields keys: ${fullEntry.customFields ? Object.keys(fullEntry.customFields).join(', ') : 'undefined'}`);
          console.log(`[KeePassConnectionStorage] Full entry fields count: ${fullEntry.fields ? fullEntry.fields.length : 'undefined'}`);
          
          const connectionIdFromCustomFields = fullEntry.customFields?.[`${CUSTOM_FIELD_PREFIX}id`];
          const connectionIdFromFields = fullEntry.fields?.find(f => f.key === `${CUSTOM_FIELD_PREFIX}id`)?.value;
          console.log(`[KeePassConnectionStorage] Full entry has finanalyzer_id from customFields: ${!!connectionIdFromCustomFields}`);
          console.log(`[KeePassConnectionStorage] Full entry has finanalyzer_id from fields: ${!!connectionIdFromFields}`);
          
          const hasConnectionId = connectionIdFromCustomFields || connectionIdFromFields;
          if (hasConnectionId) {
            const connection = this.convertEntryToConnection(fullEntry);
            if (connection) {
              this.cache.set(connection.id, connection);
              this.entryIdMap.set(connection.id, fullEntry.id);
              console.log(`[KeePassConnectionStorage] Added connection: ${connection.id} - ${connection.name}`);
            }
          }
        } catch (entryError) {
          console.error(`[KeePassConnectionStorage] Failed to fetch full entry ${item.id}:`, entryError);
        }
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    }
  }

  private async createEntry(connection: Connection): Promise<string> {
    if (!this.finanalyzerGroupId) {
      throw new Error('finanalyzer group not initialized');
    }

    const entryData = this.convertConnectionToEntry(connection);
    
    const result = await this.apiPost<KeePassItem>(
      `/api/vault/groups/${this.finanalyzerGroupId}/entries`,
      entryData
    );

    return result.id;
  }

  private async updateEntry(entryId: string, connection: Connection): Promise<void> {
    const entryData = this.convertConnectionToEntry(connection);
    
    await this.apiPut<KeePassItem>(
      `/api/vault/entries/${entryId}`,
      entryData
    );
  }

  private async deleteEntry(entryId: string): Promise<void> {
    await this.apiDelete(`/api/vault/entries/${entryId}`);
  }

  private getFieldValue(entry: KeePassItem, key: string): string | undefined {
    if (entry.customFields?.[key]) {
      return entry.customFields[key];
    }
    
    if (entry.fields) {
      const field = entry.fields.find(f => f.key === key);
      if (field) {
        return field.value;
      }
    }
    
    return undefined;
  }

  private convertEntryToConnection(entry: KeePassItem): Connection | null {
    const connectionId = this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}id`);
    if (!connectionId) {
      return null;
    }

    try {
      const authenticationStr = this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}authentication`);
      const authentication = authenticationStr ? JSON.parse(authenticationStr) : [];
      
      const metricsStr = this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}metrics`);
      const metrics = metricsStr ? JSON.parse(metricsStr) : { apps: 0, widgets: 0, prompts: 0, agents: 0 };

      return {
        id: connectionId,
        name: entry.name || '',
        url: entry.url || '',
        apiKey: entry.username || '',
        apiSecret: entry.password || '',
        description: entry.notes || undefined,
        validateWidgets: this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}validateWidgets`) === 'true',
        authType: (this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}authType`) as Connection['authType']) || 'none',
        authentication,
        status: (this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}status`) as Connection['status']) || 'disconnected',
        metrics,
        lastActivity: this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}lastActivity`) || new Date().toISOString(),
        createdAt: this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}createdAt`) || new Date().toISOString(),
        updatedAt: this.getFieldValue(entry, `${CUSTOM_FIELD_PREFIX}updatedAt`) || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to convert entry to connection:', error);
      return null;
    }
  }

  private convertConnectionToEntry(connection: Connection): Record<string, unknown> {
    const customFields: Record<string, string> = {
      [`${CUSTOM_FIELD_PREFIX}id`]: connection.id,
      [`${CUSTOM_FIELD_PREFIX}validateWidgets`]: String(connection.validateWidgets),
      [`${CUSTOM_FIELD_PREFIX}authType`]: connection.authType,
      [`${CUSTOM_FIELD_PREFIX}authentication`]: JSON.stringify(connection.authentication),
      [`${CUSTOM_FIELD_PREFIX}status`]: connection.status,
      [`${CUSTOM_FIELD_PREFIX}metrics`]: JSON.stringify(connection.metrics),
      [`${CUSTOM_FIELD_PREFIX}lastActivity`]: connection.lastActivity,
      [`${CUSTOM_FIELD_PREFIX}createdAt`]: connection.createdAt,
      [`${CUSTOM_FIELD_PREFIX}updatedAt`]: connection.updatedAt,
    };

    const fields = Object.entries(customFields).map(([key, value]) => ({
      key,
      value,
      isProtected: false,
      isBinary: false,
    }));

    return {
      type: ItemSubType.Entry,
      name: connection.name,
      username: connection.apiKey,
      password: connection.apiSecret,
      url: connection.url,
      notes: connection.description,
      customFields,
      fields,
    };
  }

  private async apiGet<T>(path: string): Promise<T> {
    const token = localStorage.getItem('passxyz-token');
    console.log(`[KeePassConnectionStorage] API GET: ${path}, token present: ${!!token}`);
    const response = await fetch(path, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[KeePassConnectionStorage] API GET response: ${path}, status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  private async apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = localStorage.getItem('passxyz-token');
    console.log(`[KeePassConnectionStorage] API POST: ${path}, token present: ${!!token}, body keys: ${Object.keys(body).join(', ')}`);
    console.log(`[KeePassConnectionStorage] API POST body: ${JSON.stringify(body)}`);
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[KeePassConnectionStorage] API POST response: ${path}, status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const responseJson = await response.json();
    console.log(`[KeePassConnectionStorage] API POST response body: ${JSON.stringify(responseJson)}`);
    return responseJson;
  }

  private async apiPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = localStorage.getItem('passxyz-token');
    console.log(`[KeePassConnectionStorage] API PUT: ${path}, token present: ${!!token}, body keys: ${Object.keys(body).join(', ')}`);
    const response = await fetch(path, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[KeePassConnectionStorage] API PUT response: ${path}, status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const text = await response.text();
    if (!text) {
      console.log(`[KeePassConnectionStorage] API PUT response body is empty, returning empty object`);
      return {} as T;
    }
    
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.log(`[KeePassConnectionStorage] API PUT response is not valid JSON: "${text}", returning empty object`);
      return {} as T;
    }
  }

  private async apiDelete(path: string): Promise<void> {
    const token = localStorage.getItem('passxyz-token');
    console.log(`[KeePassConnectionStorage] API DELETE: ${path}, token present: ${!!token}`);
    const response = await fetch(path, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
  }
}