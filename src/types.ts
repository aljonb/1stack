/**
 * Base model interface with common fields
 */
export interface BaseModel {
  id: string;
  created: string;
  updated: string;
}

/**
 * Record model representing a collection record
 */
export interface RecordModel extends BaseModel {
  collectionId: string;
  collectionName: string;
  [key: string]: unknown;
}

/**
 * List result for paginated responses
 */
export interface ListResult<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

/**
 * Collection model
 */
export interface CollectionModel extends BaseModel {
  name: string;
  type: 'base' | 'auth' | 'view';
  schema: SchemaField[];
  indexes: string[];
  system: boolean;
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: Record<string, unknown>;
}

/**
 * Schema field definition
 */
export interface SchemaField {
  id: string;
  name: string;
  type: string;
  system: boolean;
  required: boolean;
  options: Record<string, unknown>;
}

/**
 * Log model
 */
export interface LogModel extends BaseModel {
  level: number;
  message: string;
  data: Record<string, unknown>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  code: number;
  message: string;
  data: {
    canBackup: boolean;
  };
}

/**
 * Auth methods response
 */
export interface AuthMethodsList {
  mfa: {
    enabled: boolean;
    duration: number;
  };
  otp: {
    enabled: boolean;
    duration: number;
  };
  password: {
    enabled: boolean;
    identityFields: string[];
  };
  oauth2: {
    enabled: boolean;
    providers: AuthProviderInfo[];
  };
}

/**
 * OAuth2 provider info
 */
export interface AuthProviderInfo {
  name: string;
  displayName: string;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  authURL: string;
}

/**
 * Auth response
 */
export interface RecordAuthResponse<T = RecordModel> {
  token: string;
  record: T;
  meta?: Record<string, unknown>;
}

/**
 * OTP response
 */
export interface OTPResponse {
  otpId: string;
}

/**
 * External auth model
 */
export interface ExternalAuthModel extends BaseModel {
  recordId: string;
  collectionId: string;
  provider: string;
  providerId: string;
}

/**
 * Backup file info
 */
export interface BackupFileInfo {
  key: string;
  size: number;
  modified: string;
}

/**
 * Cron job info
 */
export interface CronJob {
  id: string;
  expression: string;
}

/**
 * Log stats entry
 */
export interface LogStatsEntry {
  total: number;
  date: string;
}

/**
 * Collection scaffolds response
 */
export interface CollectionScaffolds {
  base: CollectionModel;
  auth: CollectionModel;
  view: CollectionModel;
}

/**
 * Batch request result
 */
export interface BatchResult {
  status: number;
  body: unknown;
}

/**
 * OAuth2 auth config for browser flow
 */
export interface OAuth2AuthConfig {
  provider: string;
  scopes?: string[];
  createData?: Record<string, unknown>;
  urlCallback?: (url: string) => void | Promise<void>;
}

/**
 * Realtime subscription message
 */
export interface RecordSubscription<T = RecordModel> {
  action: 'create' | 'update' | 'delete';
  record: T;
}

/**
 * Unsubscribe function type
 */
export type UnsubscribeFunc = () => Promise<void>;
