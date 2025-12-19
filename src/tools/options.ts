/**
 * Common send options for API requests.
 */
export interface SendOptions {
  /**
   * Custom headers to send with the request.
   */
  headers?: Record<string, string>;

  /**
   * Body data to send with the request.
   */
  body?: unknown;

  /**
   * Query parameters to include in the request URL.
   */
  query?: Record<string, unknown>;

  /**
   * Request cancellation key.
   * Set to `null` to disable auto cancellation.
   * Set to a string to use as a custom request key.
   */
  requestKey?: string | null;

  /**
   * Custom fetch implementation.
   */
  fetch?: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response>;

  /**
   * Any additional fetch options to pass to the request.
   */
  [key: string]: unknown;
}

/**
 * Options for list requests.
 */
export interface ListOptions extends SendOptions {
  /**
   * Page number (1-based).
   */
  page?: number;

  /**
   * Number of items per page.
   */
  perPage?: number;

  /**
   * Sort order (e.g., "-created,title").
   */
  sort?: string;

  /**
   * Filter expression.
   */
  filter?: string;

  /**
   * Relations to expand.
   */
  expand?: string;

  /**
   * Fields to return.
   */
  fields?: string;

  /**
   * Whether to skip the total count calculation.
   */
  skipTotal?: boolean;
}

/**
 * Options for full list requests.
 */
export interface FullListOptions extends ListOptions {
  /**
   * Number of items to fetch per batch request.
   */
  batch?: number;
}

/**
 * Options for record view/get requests.
 */
export interface RecordOptions extends SendOptions {
  /**
   * Relations to expand.
   */
  expand?: string;

  /**
   * Fields to return.
   */
  fields?: string;
}

/**
 * Options for file URL requests.
 */
export interface FileOptions {
  /**
   * Thumb size/format for image files.
   */
  thumb?: string;

  /**
   * File access token for protected files.
   */
  token?: string;

  /**
   * Whether to serve the file for download.
   */
  download?: boolean;
}

/**
 * Options for realtime subscriptions.
 */
export interface RealtimeOptions extends SendOptions {
  /**
   * Relations to expand in realtime events.
   */
  expand?: string;

  /**
   * Fields to include in realtime events.
   */
  fields?: string;

  /**
   * Filter expression for realtime events.
   */
  filter?: string;
}

/**
 * Options for auth requests.
 */
export interface AuthOptions extends SendOptions {
  /**
   * Relations to expand in the auth response.
   */
  expand?: string;

  /**
   * Fields to include in the auth response.
   */
  fields?: string;
}

/**
 * Options for OAuth2 requests.
 */
export interface OAuth2Options extends AuthOptions {
  /**
   * OAuth2 scopes to request.
   */
  scopes?: string[];

  /**
   * Additional data to create/update in the user record.
   */
  createData?: Record<string, unknown>;

  /**
   * URL callback function (for custom OAuth2 popup handling).
   */
  urlCallback?: (url: string) => void | Promise<void>;
}

/**
 * Options for collection import.
 */
export interface CollectionImportOptions extends SendOptions {
  /**
   * Whether to delete collections not present in the import.
   */
  deleteMissing?: boolean;
}

