import type { BaseAuthStore } from './stores/BaseAuthStore';
import type { RealtimeService } from './services/RealtimeService';
import type { SendOptions } from './tools/options';

/**
 * Client interface that defines the core PocketBase client contract.
 */
export interface Client {
  /**
   * The base URL of the PocketBase instance.
   */
  baseURL: string;

  /**
   * The auth store instance.
   */
  authStore: BaseAuthStore;

  /**
   * The realtime service instance.
   */
  realtime: RealtimeService;

  /**
   * Sends an API request.
   */
  send<T = unknown>(path: string, options?: SendOptions): Promise<T>;

  /**
   * Builds a full URL from the given path.
   */
  buildURL(path: string): string;
}

