import type { Client } from './Client';
import type { RecordModel } from './types';
import type { SendOptions } from './tools/options';
import { ClientResponseError } from './ClientResponseError';
import { BaseAuthStore, LocalAuthStore } from './stores';
import {
  RecordService,
  RealtimeService,
  FileService,
  CollectionService,
  LogService,
  SettingsService,
  BackupService,
  CronService,
  HealthService,
  BatchService,
} from './services';
import { filter as filterHelper } from './tools/filter';

/**
 * BeforeSend hook type.
 */
export type BeforeSendFunc = (
  url: string,
  options: RequestInit
) => { url: string; options: RequestInit } | Promise<{ url: string; options: RequestInit }>;

/**
 * AfterSend hook type.
 */
export type AfterSendFunc = (
  response: Response,
  data: unknown
) => unknown | Promise<unknown>;

/**
 * PocketBase is the main client class for interacting with the PocketBase API.
 */
export default class PocketBase implements Client {
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
  readonly realtime: RealtimeService;

  /**
   * The file service instance.
   */
  readonly files: FileService;

  /**
   * The collection service instance.
   */
  readonly collections: CollectionService;

  /**
   * The log service instance.
   */
  readonly logs: LogService;

  /**
   * The settings service instance.
   */
  readonly settings: SettingsService;

  /**
   * The backup service instance.
   */
  readonly backups: BackupService;

  /**
   * The cron service instance.
   */
  readonly crons: CronService;

  /**
   * The health service instance.
   */
  readonly health: HealthService;

  /**
   * Hook that is invoked right before sending a request.
   */
  beforeSend?: BeforeSendFunc;

  /**
   * Hook that is invoked after successfully receiving a response.
   */
  afterSend?: AfterSendFunc;

  private _autoCancellation = true;
  private _cancelControllers: Map<string, AbortController> = new Map();
  private _recordServices: Map<string, RecordService> = new Map();

  constructor(baseURL = '/', authStore?: BaseAuthStore) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.authStore = authStore || new LocalAuthStore();

    // Initialize services
    this.realtime = new RealtimeService(this);
    this.files = new FileService(this);
    this.collections = new CollectionService(this);
    this.logs = new LogService(this);
    this.settings = new SettingsService(this);
    this.backups = new BackupService(this);
    this.crons = new CronService(this);
    this.health = new HealthService(this);
  }

  /**
   * Returns a RecordService for the specified collection.
   */
  collection<T extends RecordModel = RecordModel>(
    idOrName: string
  ): RecordService<T> {
    // Cache record services for reuse
    let service = this._recordServices.get(idOrName);
    if (!service) {
      service = new RecordService<T>(this, idOrName);
      this._recordServices.set(idOrName, service);
    }
    return service as RecordService<T>;
  }

  /**
   * Creates a new batch instance.
   */
  createBatch(): BatchService {
    return new BatchService(this);
  }

  /**
   * Generates a filter expression string with placeholder parameters.
   */
  filter(expr: string, params: Record<string, unknown> = {}): string {
    return filterHelper(expr, params);
  }

  /**
   * Enables or disables auto cancellation for pending duplicated requests.
   */
  autoCancellation(enable: boolean): this {
    this._autoCancellation = enable;
    return this;
  }

  /**
   * Cancels all pending requests.
   */
  cancelAllRequests(): this {
    for (const controller of this._cancelControllers.values()) {
      controller.abort();
    }
    this._cancelControllers.clear();
    return this;
  }

  /**
   * Cancels a single request by its cancellation key.
   */
  cancelRequest(cancelKey: string): this {
    const controller = this._cancelControllers.get(cancelKey);
    if (controller) {
      controller.abort();
      this._cancelControllers.delete(cancelKey);
    }
    return this;
  }

  /**
   * Builds a full URL from the given path.
   */
  buildURL(path: string): string {
    let url = this.baseURL;

    if (path) {
      // Ensure path starts with /
      if (!path.startsWith('/')) {
        url += '/';
      }
      url += path;
    }

    return url;
  }

  /**
   * Sends an API request.
   */
  async send<T = unknown>(path: string, options: SendOptions = {}): Promise<T> {
    // Build the request URL
    let url = this.buildURL(path);

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: (options.method as string) || 'GET',
      headers: {},
    };

    // Add auth header if authenticated
    if (this.authStore.token) {
      (fetchOptions.headers as Record<string, string>)['Authorization'] =
        this.authStore.token;
    }

    // Merge custom headers
    if (options.headers) {
      Object.assign(fetchOptions.headers as Record<string, string>, options.headers);
    }

    // Handle query parameters
    if (options.query && Object.keys(options.query).length > 0) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          queryParams.append(
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          );
        }
      }
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    // Handle body
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        fetchOptions.body = options.body;
        // Don't set Content-Type for FormData - let the browser set it with boundary
      } else if (
        options.body !== null &&
        typeof options.body === 'object' &&
        this.hasFileFields(options.body as Record<string, unknown>)
      ) {
        // Convert to FormData if there are file fields
        fetchOptions.body = this.objectToFormData(
          options.body as Record<string, unknown>
        );
      } else {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] =
          'application/json';
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    // Copy additional fetch options
    const knownOptions = [
      'method',
      'headers',
      'body',
      'query',
      'requestKey',
      'fetch',
    ];
    for (const [key, value] of Object.entries(options)) {
      if (!knownOptions.includes(key) && value !== undefined) {
        (fetchOptions as Record<string, unknown>)[key] = value;
      }
    }

    // Handle request cancellation
    let requestKey = options.requestKey;
    if (requestKey === undefined && this._autoCancellation) {
      requestKey = `${fetchOptions.method} ${path}`;
    }

    if (requestKey !== null && requestKey !== undefined) {
      // Cancel any existing request with the same key
      this.cancelRequest(requestKey);

      // Create new abort controller
      const controller = new AbortController();
      this._cancelControllers.set(requestKey, controller);
      fetchOptions.signal = controller.signal;
    }

    // Apply beforeSend hook
    if (this.beforeSend) {
      const hookResult = await Promise.resolve(
        this.beforeSend(url, fetchOptions)
      );
      url = hookResult.url;
      Object.assign(fetchOptions, hookResult.options);
    }

    // Perform the fetch
    let response: Response;
    try {
      const fetchFunc = options.fetch || fetch;
      response = await fetchFunc(url, fetchOptions);
    } catch (err) {
      // Clean up controller
      if (requestKey !== null && requestKey !== undefined) {
        this._cancelControllers.delete(requestKey);
      }

      // Check if it was aborted
      if ((err as Error).name === 'AbortError') {
        throw new ClientResponseError({
          url,
          isAbort: true,
          originalError: err,
        });
      }

      throw new ClientResponseError({
        url,
        originalError: err,
      });
    }

    // Clean up controller
    if (requestKey !== null && requestKey !== undefined) {
      this._cancelControllers.delete(requestKey);
    }

    // Parse response
    let data: unknown = null;
    try {
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (response.status !== 204) {
        data = await response.text();
      }
    } catch {
      // Ignore parse errors
    }

    // Apply afterSend hook
    if (this.afterSend) {
      data = await Promise.resolve(this.afterSend(response, data));
    }

    // Handle error responses
    if (!response.ok) {
      throw new ClientResponseError({
        url,
        status: response.status,
        response: data as Record<string, unknown>,
      });
    }

    return data as T;
  }

  /**
   * Checks if an object has File or Blob fields.
   */
  private hasFileFields(obj: Record<string, unknown>): boolean {
    for (const value of Object.values(obj)) {
      if (value instanceof File || value instanceof Blob) {
        return true;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof File || item instanceof Blob) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Converts an object to FormData.
   */
  private objectToFormData(obj: Record<string, unknown>): FormData {
    const formData = new FormData();

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof File || item instanceof Blob) {
            formData.append(key, item);
          } else if (item !== undefined && item !== null) {
            formData.append(key, String(item));
          }
        }
      } else if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else if (value !== null && typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else if (value !== null) {
        formData.append(key, String(value));
      }
    }

    return formData;
  }
}
