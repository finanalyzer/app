import type { IConnectionStorage } from './IConnectionStorage';
import { LocalStorageConnectionStorage } from './LocalStorageConnectionStorage';
import { KeePassConnectionStorage } from './KeePassConnectionStorage';

const STORAGE_TYPE = import.meta.env.VITE_CONNECTION_STORAGE || 'localstorage';

export class ConnectionStorageFactory {
  private static instance: IConnectionStorage | null = null;
  private static initializationPromise: Promise<void> | null = null;

  static async getInstanceAsync(): Promise<IConnectionStorage> {
    if (ConnectionStorageFactory.instance) {
      return ConnectionStorageFactory.instance;
    }

    if (ConnectionStorageFactory.initializationPromise) {
      await ConnectionStorageFactory.initializationPromise;
      return ConnectionStorageFactory.instance!;
    }

    ConnectionStorageFactory.initializationPromise = (async () => {
      let storage: IConnectionStorage;

      switch (STORAGE_TYPE) {
        case 'keepass':
          const keepassStorage = new KeePassConnectionStorage();
          try {
            await keepassStorage.initialize();
            storage = keepassStorage;
          } catch {
            console.warn('KeePass storage initialization failed, falling back to localStorage');
            storage = new LocalStorageConnectionStorage();
          }
          break;

        case 'localstorage':
        default:
          storage = new LocalStorageConnectionStorage();
          break;
      }

      ConnectionStorageFactory.instance = storage;
    })();

    await ConnectionStorageFactory.initializationPromise;
    return ConnectionStorageFactory.instance!;
  }

  static getInstance(): IConnectionStorage {
    if (!ConnectionStorageFactory.instance) {
      throw new Error('ConnectionStorageFactory not initialized. Call getInstanceAsync() first.');
    }
    return ConnectionStorageFactory.instance;
  }

  static setStorageType(type: 'localstorage' | 'keepass'): void {
    ConnectionStorageFactory.instance = null;
    ConnectionStorageFactory.initializationPromise = null;
    (import.meta.env as Record<string, string>).VITE_CONNECTION_STORAGE = type;
  }

  static getStorageType(): string {
    return STORAGE_TYPE;
  }

  static async reset(): Promise<void> {
    ConnectionStorageFactory.instance = null;
    ConnectionStorageFactory.initializationPromise = null;
    await ConnectionStorageFactory.getInstanceAsync();
  }
}