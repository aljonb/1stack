import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { SendOptions } from '../tools/options';

/**
 * SettingsService provides access to app settings.
 */
export class SettingsService extends BaseService {
  constructor(client: Client) {
    super(client);
  }

  /**
   * Returns all available app settings.
   */
  async getAll(options: SendOptions = {}): Promise<Record<string, unknown>> {
    return this.client.send<Record<string, unknown>>('/api/settings', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Bulk updates app settings.
   */
  async update(
    bodyParams: Record<string, unknown> = {},
    options: SendOptions = {}
  ): Promise<Record<string, unknown>> {
    return this.client.send<Record<string, unknown>>('/api/settings', {
      method: 'PATCH',
      ...options,
      body: bodyParams,
    });
  }

  /**
   * Performs a S3 storage connection test.
   */
  async testS3(
    filesystem = 'storage',
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send('/api/settings/test/s3', {
      method: 'POST',
      ...options,
      body: { filesystem },
    });
    return true;
  }

  /**
   * Sends a test email.
   */
  async testEmail(
    collectionIdOrName: string,
    toEmail: string,
    template: 'verification' | 'password-reset' | 'email-change',
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send('/api/settings/test/email', {
      method: 'POST',
      ...options,
      body: {
        collection: collectionIdOrName,
        email: toEmail,
        template,
      },
    });
    return true;
  }

  /**
   * Generates a new Apple OAuth2 client secret.
   */
  async generateAppleClientSecret(
    clientId: string,
    teamId: string,
    keyId: string,
    privateKey: string,
    duration: number,
    options: SendOptions = {}
  ): Promise<{ secret: string }> {
    return this.client.send<{ secret: string }>(
      '/api/settings/apple/generate-client-secret',
      {
        method: 'POST',
        ...options,
        body: {
          clientId,
          teamId,
          keyId,
          privateKey,
          duration,
        },
      }
    );
  }
}
