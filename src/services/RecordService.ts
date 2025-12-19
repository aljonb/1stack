import { CrudService } from './CrudService';
import type { Client } from '../Client';
import type {
  RecordModel,
  RecordAuthResponse,
  AuthMethodsList,
  OTPResponse,
  ExternalAuthModel,
  RecordSubscription,
  UnsubscribeFunc,
  OAuth2AuthConfig,
} from '../types';
import type {
  ListOptions,
  RecordOptions,
  SendOptions,
  AuthOptions,
  RealtimeOptions,
} from '../tools/options';

/**
 * RecordService handles CRUD operations for collection records,
 * as well as authentication and realtime subscriptions.
 */
export class RecordService<T extends RecordModel = RecordModel> extends CrudService<T> {
  readonly collectionIdOrName: string;

  constructor(client: Client, collectionIdOrName: string) {
    super(client);
    this.collectionIdOrName = collectionIdOrName;
  }

  get baseCrudPath(): string {
    return `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/records`;
  }

  /**
   * Base path for the collection (without /records suffix).
   * Used for auth endpoints.
   */
  get baseCollectionPath(): string {
    return `/api/collections/${encodeURIComponent(this.collectionIdOrName)}`;
  }

  // ---------------------------------------------------------------
  // Realtime handlers
  // ---------------------------------------------------------------

  /**
   * Subscribes to realtime changes for this collection.
   *
   * @param topic - The topic to subscribe to ("*" for all records, or a specific record ID)
   * @param callback - Callback function to handle realtime events
   * @param options - Additional options
   */
  async subscribe(
    topic: string,
    callback: (data: RecordSubscription<T>) => void,
    options: RealtimeOptions = {}
  ): Promise<UnsubscribeFunc> {
    const fullTopic = `${this.collectionIdOrName}/${topic}`;

    return this.client.realtime.subscribe(
      fullTopic,
      (data) => {
        callback(data as RecordSubscription<T>);
      },
      options
    );
  }

  /**
   * Unsubscribes from realtime changes for this collection.
   *
   * @param topic - The topic to unsubscribe from (optional, if not provided unsubscribes from all)
   */
  async unsubscribe(topic?: string): Promise<void> {
    if (topic) {
      return this.client.realtime.unsubscribe(
        `${this.collectionIdOrName}/${topic}`
      );
    }
    return this.client.realtime.unsubscribeByPrefix(
      `${this.collectionIdOrName}/`
    );
  }

  // ---------------------------------------------------------------
  // Auth handlers
  // ---------------------------------------------------------------

  /**
   * Returns all available auth methods for the collection.
   */
  async listAuthMethods(options: SendOptions = {}): Promise<AuthMethodsList> {
    return this.client.send<AuthMethodsList>(
      `${this.baseCollectionPath}/auth-methods`,
      {
        method: 'GET',
        ...options,
      }
    );
  }

  /**
   * Authenticates a record with username/email and password.
   */
  async authWithPassword(
    usernameOrEmail: string,
    password: string,
    options: AuthOptions = {}
  ): Promise<RecordAuthResponse<T>> {
    const result = await this.client.send<RecordAuthResponse<T>>(
      `${this.baseCollectionPath}/auth-with-password`,
      {
        method: 'POST',
        ...options,
        body: {
          identity: usernameOrEmail,
          password,
        },
        query: this.extractQueryParams(options),
      }
    );

    this.client.authStore.save(result.token, result.record);

    return result;
  }

  /**
   * Authenticates a record with OTP.
   */
  async authWithOTP(
    otpId: string,
    password: string,
    options: AuthOptions = {}
  ): Promise<RecordAuthResponse<T>> {
    const result = await this.client.send<RecordAuthResponse<T>>(
      `${this.baseCollectionPath}/auth-with-otp`,
      {
        method: 'POST',
        ...options,
        body: {
          otpId,
          password,
        },
        query: this.extractQueryParams(options),
      }
    );

    this.client.authStore.save(result.token, result.record);

    return result;
  }

  /**
   * Authenticates a record with OAuth2 (browser popup flow).
   */
  async authWithOAuth2(config: OAuth2AuthConfig): Promise<RecordAuthResponse<T>> {
    const authMethods = await this.listAuthMethods();

    const provider = authMethods.oauth2.providers.find(
      (p) => p.name === config.provider
    );

    if (!provider) {
      throw new Error(`Missing or invalid OAuth2 provider "${config.provider}".`);
    }

    // Build the OAuth2 URL
    const redirectURL = this.client.buildURL('/api/oauth2-redirect');
    let authURL = provider.authURL + redirectURL;

    if (config.scopes?.length) {
      authURL += '&scope=' + encodeURIComponent(config.scopes.join(' '));
    }

    // Handle custom URL callback
    if (config.urlCallback) {
      await config.urlCallback(authURL);
    } else if (typeof window !== 'undefined') {
      // Open popup window
      const width = 1024;
      const height = 768;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        authURL,
        'pocketbase_oauth2_popup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error('Failed to open OAuth2 popup window.');
      }

      // Wait for the popup to close and get the result
      const result = await new Promise<{ code: string; state: string }>(
        (resolve, reject) => {
          const handleMessage = (event: MessageEvent) => {
            if (
              event.origin !== window.location.origin ||
              !event.data?.code
            ) {
              return;
            }

            window.removeEventListener('message', handleMessage);
            clearInterval(pollTimer);
            resolve(event.data as { code: string; state: string });
          };

          window.addEventListener('message', handleMessage);

          const pollTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(pollTimer);
              window.removeEventListener('message', handleMessage);
              reject(new Error('OAuth2 popup was closed.'));
            }
          }, 200);
        }
      );

      // Exchange the code for auth
      return this.authWithOAuth2Code(
        config.provider,
        result.code,
        provider.codeVerifier,
        redirectURL,
        config.createData,
        {}
      );
    } else {
      throw new Error('OAuth2 popup is only available in browser environments.');
    }

    // This is for when urlCallback is provided
    return {} as RecordAuthResponse<T>;
  }

  /**
   * Authenticates a record with OAuth2 code.
   */
  async authWithOAuth2Code(
    provider: string,
    code: string,
    codeVerifier: string,
    redirectURL: string,
    createData: Record<string, unknown> = {},
    options: AuthOptions = {}
  ): Promise<RecordAuthResponse<T>> {
    const result = await this.client.send<RecordAuthResponse<T>>(
      `${this.baseCollectionPath}/auth-with-oauth2`,
      {
        method: 'POST',
        ...options,
        body: {
          provider,
          code,
          codeVerifier,
          redirectURL,
          createData,
        },
        query: this.extractQueryParams(options),
      }
    );

    this.client.authStore.save(result.token, result.record);

    return result;
  }

  /**
   * Refreshes the current authenticated record and token.
   */
  async authRefresh(options: AuthOptions = {}): Promise<RecordAuthResponse<T>> {
    const result = await this.client.send<RecordAuthResponse<T>>(
      `${this.baseCollectionPath}/auth-refresh`,
      {
        method: 'POST',
        ...options,
        query: this.extractQueryParams(options),
      }
    );

    this.client.authStore.save(result.token, result.record);

    return result;
  }

  /**
   * Sends an OTP email to the specified email address.
   */
  async requestOTP(
    email: string,
    options: SendOptions = {}
  ): Promise<OTPResponse> {
    return this.client.send<OTPResponse>(`${this.baseCollectionPath}/request-otp`, {
      method: 'POST',
      ...options,
      body: { email },
    });
  }

  /**
   * Sends a password reset email.
   */
  async requestPasswordReset(
    email: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCollectionPath}/request-password-reset`, {
      method: 'POST',
      ...options,
      body: { email },
    });
    return true;
  }

  /**
   * Confirms a password reset request.
   */
  async confirmPasswordReset(
    resetToken: string,
    newPassword: string,
    newPasswordConfirm: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCollectionPath}/confirm-password-reset`, {
      method: 'POST',
      ...options,
      body: {
        token: resetToken,
        password: newPassword,
        passwordConfirm: newPasswordConfirm,
      },
    });
    return true;
  }

  /**
   * Sends a verification email.
   */
  async requestVerification(
    email: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCollectionPath}/request-verification`, {
      method: 'POST',
      ...options,
      body: { email },
    });
    return true;
  }

  /**
   * Confirms a verification request.
   */
  async confirmVerification(
    verificationToken: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCollectionPath}/confirm-verification`, {
      method: 'POST',
      ...options,
      body: { token: verificationToken },
    });
    return true;
  }

  /**
   * Sends an email change request.
   */
  async requestEmailChange(
    newEmail: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCollectionPath}/request-email-change`, {
      method: 'POST',
      ...options,
      body: { newEmail },
    });
    return true;
  }

  /**
   * Confirms an email change request.
   */
  async confirmEmailChange(
    emailChangeToken: string,
    userPassword: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCollectionPath}/confirm-email-change`, {
      method: 'POST',
      ...options,
      body: {
        token: emailChangeToken,
        password: userPassword,
      },
    });
    return true;
  }

  /**
   * Lists all linked external auth providers for the specified record.
   */
  async listExternalAuths(
    recordId: string,
    options: ListOptions = {}
  ): Promise<ExternalAuthModel[]> {
    return this.client.send<ExternalAuthModel[]>(
      `${this.baseCrudPath}/${encodeURIComponent(recordId)}/external-auths`,
      {
        method: 'GET',
        ...options,
        query: this.extractQueryParams(options),
      }
    );
  }

  /**
   * Unlinks an external auth provider from the specified record.
   */
  async unlinkExternalAuth(
    recordId: string,
    provider: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(
      `${this.baseCrudPath}/${encodeURIComponent(recordId)}/external-auths/${encodeURIComponent(provider)}`,
      {
        method: 'DELETE',
        ...options,
      }
    );
    return true;
  }

  /**
   * Impersonates the specified record and returns a new client with the received auth token.
   */
  async impersonate(
    recordId: string,
    duration: number,
    options: RecordOptions = {}
  ): Promise<Client> {
    // Import here to avoid circular dependency
    const { default: PocketBase } = await import('../PocketBase');

    const result = await this.client.send<{ token: string }>(
      `${this.baseCrudPath}/${encodeURIComponent(recordId)}/impersonate`,
      {
        method: 'POST',
        ...options,
        body: { duration },
        query: this.extractQueryParams(options),
      }
    );

    // Create a new client with memory-only auth store
    const impersonatedClient = new PocketBase(this.client.baseURL);

    // Get the record data
    const record = await impersonatedClient.collection(this.collectionIdOrName).authRefresh({
      headers: { Authorization: result.token },
    });

    impersonatedClient.authStore.save(result.token, record.record as T);

    return impersonatedClient;
  }
}
