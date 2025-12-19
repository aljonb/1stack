// Main export
export { default } from './PocketBase';
export { default as PocketBase } from './PocketBase';
export type { BeforeSendFunc, AfterSendFunc } from './PocketBase';

// Client interface
export type { Client } from './Client';

// Types
export type {
  BaseModel,
  RecordModel,
  ListResult,
  CollectionModel,
  SchemaField,
  LogModel,
  HealthCheckResponse,
  AuthMethodsList,
  AuthProviderInfo,
  RecordAuthResponse,
  OTPResponse,
  ExternalAuthModel,
  BackupFileInfo,
  CronJob,
  LogStatsEntry,
  CollectionScaffolds,
  BatchResult,
  OAuth2AuthConfig,
  RecordSubscription,
  UnsubscribeFunc,
} from './types';

// Error
export { ClientResponseError } from './ClientResponseError';

// Auth stores
export {
  BaseAuthStore,
  LocalAuthStore,
  AsyncAuthStore,
} from './stores';
export type {
  OnStoreChangeFunc,
  CookieOptions,
  AsyncAuthStoreOptions,
  AuthStoreState,
  Subscriber,
  Unsubscriber,
} from './stores';

// Services
export {
  BaseService,
  CrudService,
  RecordService,
  RealtimeService,
  PB_CONNECT,
  FileService,
  CollectionService,
  LogService,
  SettingsService,
  BackupService,
  CronService,
  HealthService,
  BatchService,
} from './services';
export type { SubscriptionFunc } from './services';

// Tools/Options
export type {
  SendOptions,
  ListOptions,
  FullListOptions,
  RecordOptions,
  FileOptions,
  RealtimeOptions,
  AuthOptions,
  OAuth2Options,
  CollectionImportOptions,
} from './tools/options';

// Filter helper
export { filter } from './tools/filter';
