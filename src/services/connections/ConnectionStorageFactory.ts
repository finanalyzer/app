import type { IConnectionStorage } from './IConnectionStorage';
import { LocalStorageConnectionStorage } from './LocalStorageConnectionStorage';
import { KeePassConnectionStorage } from './KeePassConnectionStorage';

const STORAGE_TYPE = import.meta.env.VITE_CONNECTION_STORAGE || 'localstorage';

export class ConnectionStorageFactory {
  private static instance: IConnectionStorage | null = null;

  static getInstance(): IConnectionStorage {
    if (ConnectionStorageFactory.instance) {
      return ConnectionStorageFactory.instance;
    }

    let storage: IConnectionStorage;

    switch (STORAGE_TYPE) {
      case 'keepass':
        const keepassStorage = new KeePassConnectionStorage();
        storage = keepassStorage.isAvailable()
          ? keepassStorage
          : new LocalStorageConnectionStorage();
        break;

      case 'localstorage':
      default:
        storage = new LocalStorageConnectionStorage();
        break;
    }

    ConnectionStorageFactory.instance = storage;
    return storage;
  }

  static setStorageType(type: 'localstorage' | 'keepass'): void {
    ConnectionStorageFactory.instance = null;
    (import.meta.env as Record<string, string>).VITE_CONNECTION_STORAGE = type;
  }

  static getStorageType(): string {
    return STORAGE_TYPE;
  }
}