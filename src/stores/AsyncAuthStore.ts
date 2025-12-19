import { BaseAuthStore } from './BaseAuthStore';
import type { RecordModel } from '../types';

export interface AsyncAuthStoreOptions {
  /**
   * Function to save the serialized auth store state.
   */
  save: (serialized: string) => Promise<void>;

  /**
   * Initial serialized auth store state (can be a Promise).
   */
  initial?: string | Promise<string | null> | null;

  /**
   * Optional function to clear the stored auth state.
   */
  clear?: () => Promise<void>;
}

/**
 * AsyncAuthStore is an auth store helper for integrating with
 * async 3rd party storage implementations (e.g., React Native AsyncStorage).
 */
export class AsyncAuthStore extends BaseAuthStore {
  private saveFunc: (serialized: string) => Promise<void>;
  private clearFunc?: () => Promise<void>;
  private _initialPromise: Promise<void> | null = null;

  constructor(options: AsyncAuthStoreOptions) {
    super();

    this.saveFunc = options.save;
    this.clearFunc = options.clear;

    // Load initial data
    this._initialPromise = this._loadInitial(options.initial);
  }

  /**
   * Wait for the initial load to complete.
   */
  async awaitInitial(): Promise<void> {
    if (this._initialPromise) {
      await this._initialPromise;
      this._initialPromise = null;
    }
  }

  /**
   * Loads the initial auth state.
   */
  private async _loadInitial(
    initial?: string | Promise<string | null> | null
  ): Promise<void> {
    if (!initial) {
      return;
    }

    let serialized: string | null = null;

    try {
      serialized = await Promise.resolve(initial);
    } catch {
      // Ignore errors loading initial state
      return;
    }

    if (!serialized) {
      return;
    }

    try {
      const data = JSON.parse(serialized) as {
        token?: string;
        record?: RecordModel | null;
      };
      this.baseToken = data.token || '';
      this.baseRecord = data.record ?? null;
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Saves new authentication data in the store.
   */
  override save(token: string, record?: RecordModel | null): void {
    super.save(token, record);

    const serialized = JSON.stringify({
      token: this.token,
      record: this.record,
    });

    // Fire and forget - we don't await the save
    this.saveFunc(serialized).catch(() => {
      // Ignore save errors
    });
  }

  /**
   * Clears the store from any stored authentication data.
   */
  override clear(): void {
    super.clear();

    if (this.clearFunc) {
      this.clearFunc().catch(() => {
        // Ignore clear errors
      });
    } else {
      // Save empty state
      this.saveFunc(JSON.stringify({ token: '', record: null })).catch(() => {
        // Ignore save errors
      });
    }
  }
}
