import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { BackupFileInfo } from '../types';
import type { SendOptions } from '../tools/options';

/**
 * BackupService provides backup-related operations.
 */
export class BackupService extends BaseService {
  constructor(client: Client) {
    super(client);
  }

  /**
   * Returns list with all available backup files.
   */
  async getFullList(options: SendOptions = {}): Promise<BackupFileInfo[]> {
    return this.client.send<BackupFileInfo[]>('/api/backups', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Initializes a new backup.
   */
  async create(
    basename = '',
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send('/api/backups', {
      method: 'POST',
      ...options,
      body: { name: basename },
    });
    return true;
  }

  /**
   * Uploads an existing app data backup.
   */
  async upload(
    data: { file: Blob | File },
    options: SendOptions = {}
  ): Promise<boolean> {
    const formData = new FormData();
    formData.append('file', data.file);

    await this.client.send('/api/backups/upload', {
      method: 'POST',
      ...options,
      body: formData,
    });
    return true;
  }

  /**
   * Deletes a single backup by its key.
   */
  async delete(key: string, options: SendOptions = {}): Promise<boolean> {
    await this.client.send(`/api/backups/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      ...options,
    });
    return true;
  }

  /**
   * Initializes an app data restore from an existing backup.
   */
  async restore(key: string, options: SendOptions = {}): Promise<boolean> {
    await this.client.send(`/api/backups/${encodeURIComponent(key)}/restore`, {
      method: 'POST',
      ...options,
    });
    return true;
  }

  /**
   * Builds a download URL for a single existing backup.
   */
  getDownloadURL(token: string, key: string): string {
    return this.client.buildURL(
      `/api/backups/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`
    );
  }
}
