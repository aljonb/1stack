import type { RecordModel } from '../types';

export type OnStoreChangeFunc = (token: string, record: RecordModel | null) => void;

/**
 * Auth store state for Svelte store compatibility.
 */
export interface AuthStoreState {
  token: string;
  record: RecordModel | null;
  isValid: boolean;
  isSuperuser: boolean;
}

/**
 * Svelte-compatible store subscriber function.
 */
export type Subscriber<T> = (value: T) => void;

/**
 * Svelte-compatible unsubscribe function.
 */
export type Unsubscriber = () => void;

/**
 * Cookie serialize options
 */
export interface CookieOptions {
  path?: string;
  expires?: Date;
  maxAge?: number;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | boolean;
  encode?: (val: string) => string;
}

/**
 * Decodes a JWT token without validation
 */
function decodeToken(token: string): Record<string, unknown> {
  if (!token) {
    return {};
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return {};
  }

  try {
    const payload = parts[1];
    // Handle both browser and Node.js environments
    const decoded =
      typeof atob === 'function'
        ? atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Checks if a JWT token is expired
 */
function isTokenExpired(token: string, expirationThreshold = 0): boolean {
  const decoded = decodeToken(token);
  const exp = decoded.exp as number | undefined;

  if (!exp) {
    return true;
  }

  // Convert to milliseconds and add threshold
  const expireDate = exp * 1000 - expirationThreshold;
  return Date.now() >= expireDate;
}

/**
 * Parses a cookie string into key-value pairs
 */
function parseCookie(cookieStr: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!cookieStr) {
    return result;
  }

  const pairs = cookieStr.split(';');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    const trimmedKey = key?.trim();
    if (trimmedKey) {
      result[trimmedKey] = decodeURIComponent(valueParts.join('=').trim());
    }
  }

  return result;
}

/**
 * Serializes a cookie with options
 */
function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  if (typeof options.maxAge === 'number') {
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options.secure) {
    cookie += '; Secure';
  }

  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }

  if (options.sameSite) {
    const sameSiteValue =
      options.sameSite === true ? 'Strict' : options.sameSite;
    cookie += `; SameSite=${sameSiteValue}`;
  }

  return cookie;
}

/**
 * BaseAuthStore is the base class for all auth store implementations.
 */
export abstract class BaseAuthStore {
  protected baseToken: string = '';
  protected baseRecord: RecordModel | null = null;
  private _onChangeCallbacks: OnStoreChangeFunc[] = [];

  /**
   * Returns the stored authentication token.
   */
  get token(): string {
    return this.baseToken;
  }

  /**
   * Returns the stored authenticated record model.
   */
  get record(): RecordModel | null {
    return this.baseRecord;
  }

  /**
   * Checks if the store has a valid (non-expired) token.
   */
  get isValid(): boolean {
    return !!this.token && !isTokenExpired(this.token);
  }

  /**
   * Checks if the store state is for a superuser.
   */
  get isSuperuser(): boolean {
    const decoded = decodeToken(this.token);
    return decoded.type === 'superuser' || decoded.type === 'admin';
  }

  /**
   * Saves new authentication data in the store.
   */
  save(token: string, record?: RecordModel | null): void {
    this.baseToken = token || '';
    this.baseRecord = record ?? null;

    this.triggerChange();
  }

  /**
   * Clears the store from any stored authentication data.
   */
  clear(): void {
    this.baseToken = '';
    this.baseRecord = null;
    this.triggerChange();
  }

  /**
   * Loads the auth store data from the provided cookie string.
   */
  loadFromCookie(cookieStr: string, key = 'pb_auth'): void {
    const cookies = parseCookie(cookieStr);
    const raw = cookies[key] || '';

    let data: { token?: string; record?: RecordModel | null } = {};
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      // ignore parse errors
    }

    this.save(data.token || '', data.record);
  }

  /**
   * Exports the current auth store state as a cookie string.
   */
  exportToCookie(options: CookieOptions = {}, key = 'pb_auth'): string {
    const defaultOptions: CookieOptions = {
      secure: true,
      sameSite: 'Strict',
      httpOnly: true,
      path: '/',
    };

    // Calculate expiration from token
    const decoded = decodeToken(this.token);
    if (decoded.exp) {
      defaultOptions.expires = new Date((decoded.exp as number) * 1000);
    } else {
      // Default to 7 days if no exp in token
      defaultOptions.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const mergedOptions = { ...defaultOptions, ...options };

    const payload = JSON.stringify({
      token: this.token,
      record: this.record,
    });

    // Check if the cookie is too large (>4096 bytes) and truncate record if needed
    let encodedValue = encodeURIComponent(payload);
    if (encodedValue.length > 4096) {
      // Try with minimal record data
      const minimalPayload = JSON.stringify({
        token: this.token,
        record: this.record
          ? {
              id: this.record.id,
              email: (this.record as Record<string, unknown>).email,
              collectionId: this.record.collectionId,
              collectionName: this.record.collectionName,
            }
          : null,
      });
      encodedValue = encodeURIComponent(minimalPayload);

      // If still too large, just store token
      if (encodedValue.length > 4096) {
        return serializeCookie(
          key,
          JSON.stringify({ token: this.token, record: null }),
          mergedOptions
        );
      }
      return serializeCookie(key, minimalPayload, mergedOptions);
    }

    return serializeCookie(key, payload, mergedOptions);
  }

  /**
   * Registers a callback function that will be called on store change.
   *
   * You can set the `fireImmediately` param to trigger the callback
   * right after registration with the current store values.
   *
   * Returns a removal function that you can call to unsubscribe.
   */
  onChange(callback: OnStoreChangeFunc, fireImmediately = false): () => void {
    this._onChangeCallbacks.push(callback);

    if (fireImmediately) {
      callback(this.token, this.record);
    }

    return () => {
      const index = this._onChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this._onChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Svelte store-compatible subscribe method.
   *
   * This allows the auth store to be used directly with Svelte's reactive
   * `$` prefix syntax:
   *
   * ```svelte
   * <script>
   *   import { pb } from '$lib/pocketbase';
   *   // $pb.authStore is now reactive!
   * </script>
   *
   * {#if $pb.authStore.record}
   *   <p>Welcome, {$pb.authStore.record.email}</p>
   * {/if}
   * ```
   *
   * @param run - Subscriber function called with current state and on each change
   * @returns Unsubscribe function
   */
  subscribe(run: Subscriber<AuthStoreState>): Unsubscriber {
    // Immediately invoke with current state (Svelte store contract)
    run(this._currentState());

    // Register for future changes
    const callback: OnStoreChangeFunc = () => {
      run(this._currentState());
    };

    this._onChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this._onChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this._onChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Returns the current auth store state as a plain object.
   */
  private _currentState(): AuthStoreState {
    return {
      token: this.token,
      record: this.record,
      isValid: this.isValid,
      isSuperuser: this.isSuperuser,
    };
  }

  /**
   * Triggers all registered onChange callbacks.
   */
  protected triggerChange(): void {
    for (const callback of this._onChangeCallbacks) {
      callback(this.token, this.record);
    }
  }
}
