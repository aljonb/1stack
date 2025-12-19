import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { RecordModel } from '../types';
import type { FileOptions, SendOptions } from '../tools/options';

/**
 * FileService provides file-related operations.
 */
export class FileService extends BaseService {
  constructor(client: Client) {
    super(client);
  }

  /**
   * Builds and returns an absolute URL to the specified record file.
   *
   * @param record - The record containing the file
   * @param filename - The filename of the file
   * @param options - Additional options like thumb size or token
   */
  getURL(
    record: RecordModel,
    filename: string,
    options: FileOptions = {}
  ): string {
    if (!record || !record.id || !record.collectionId || !filename) {
      return '';
    }

    const parts = [
      'api',
      'files',
      encodeURIComponent(record.collectionId),
      encodeURIComponent(record.id),
      encodeURIComponent(filename),
    ];

    const url = new URL(this.client.buildURL('/' + parts.join('/')));

    if (options.thumb) {
      url.searchParams.set('thumb', options.thumb);
    }

    if (options.token) {
      url.searchParams.set('token', options.token);
    }

    if (options.download) {
      url.searchParams.set('download', '1');
    }

    return url.toString();
  }

  /**
   * Requests a new private file access token for the current authenticated record.
   */
  async getToken(options: SendOptions = {}): Promise<string> {
    const result = await this.client.send<{ token: string }>(
      '/api/files/token',
      {
        method: 'POST',
        ...options,
      }
    );

    return result.token;
  }
}
