import { BaseAuthStore } from './BaseAuthStore';
import type { RecordModel } from '../types';

const LOCAL_STORAGE_KEY = 'pocketbase_auth';

/**
 * LocalAuthStore uses the browser's localStorage if available,
 * otherwise falls back to runtime/memory storage.
 *
 * It also automatically syncs the auth store state between multiple tabs.
 */
export class LocalAuthStore extends BaseAuthStore {
  private storageFallback: Record<string, string> = {};
  private storageKey: string;

  constructor(storageKey = LOCAL_STORAGE_KEY) {
    super();

    this.storageKey = storageKey;

    // Load initial data from storage
    this._loadFromStorage();

    // Listen for storage changes (cross-tab sync)
    this._bindStorageEvent();
  }

  /**
   * Returns the stored authentication token.
   */
  override get token(): string {
    const data = this._storageGet();
    return data.token || '';
  }

  /**
   * Returns the stored authenticated record model.
   */
  override get record(): RecordModel | null {
    const data = this._storageGet();
    return data.record || null;
  }

  /**
   * Saves new authentication data to the store.
   */
  override save(token: string, record?: RecordModel | null): void {
    this._storageSet({
      token: token || '',
      record: record ?? null,
    });

    super.save(token, record);
  }

  /**
   * Clears the store from any stored authentication data.
   */
  override clear(): void {
    this._storageRemove();
    super.clear();
  }

  /**
   * Loads data from storage into the base class properties.
   */
  private _loadFromStorage(): void {
    const data = this._storageGet();
    this.baseToken = data.token || '';
    this.baseRecord = data.record || null;
  }

  /**
   * Returns the parsed storage data.
   */
  private _storageGet(): { token?: string; record?: RecordModel | null } {
    const rawValue = this._storageGetRaw();

    if (!rawValue) {
      return {};
    }

    try {
      return JSON.parse(rawValue) as { token?: string; record?: RecordModel };
    } catch {
      return {};
    }
  }

  /**
   * Returns the raw storage value.
   */
  private _storageGetRaw(): string {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(this.storageKey) || '';
      } catch {
        // localStorage might throw in some environments (e.g., incognito mode)
      }
    }

    return this.storageFallback[this.storageKey] || '';
  }

  /**
   * Sets the storage data.
   */
  private _storageSet(data: {
    token: string;
    record: RecordModel | null;
  }): void {
    const rawValue = JSON.stringify(data);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, rawValue);
        return;
      } catch {
        // localStorage might throw in some environments
      }
    }

    this.storageFallback[this.storageKey] = rawValue;
  }

  /**
   * Removes the storage data.
   */
  private _storageRemove(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
        return;
      } catch {
        // localStorage might throw in some environments
      }
    }

    delete this.storageFallback[this.storageKey];
  }

  /**
   * Binds to the storage event for cross-tab synchronization.
   */
  private _bindStorageEvent(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    window.addEventListener('storage', (e) => {
      if (e.key !== this.storageKey) {
        return;
      }

      const oldData = this._storageGet();
      this._loadFromStorage();
      const newData = this._storageGet();

      // Only trigger change if the data actually changed
      if (oldData.token !== newData.token || JSON.stringify(oldData.record) !== JSON.stringify(newData.record)) {
        this.triggerChange();
      }
    });
  }
}
