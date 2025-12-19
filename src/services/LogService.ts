import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { LogModel, ListResult, LogStatsEntry } from '../types';
import type { ListOptions, SendOptions } from '../tools/options';

/**
 * LogService provides access to request logs.
 */
export class LogService extends BaseService {
  constructor(client: Client) {
    super(client);
  }

  /**
   * Returns a paginated list of logs.
   */
  async getList(
    page = 1,
    perPage = 30,
    options: ListOptions = {}
  ): Promise<ListResult<LogModel>> {
    const queryParams: Record<string, unknown> = {
      page,
      perPage,
      ...this.extractQueryParams(options),
    };

    return this.client.send<ListResult<LogModel>>('/api/logs', {
      method: 'GET',
      ...options,
      query: queryParams,
    });
  }

  /**
   * Returns a single log by its id.
   */
  async getOne(id: string, options: SendOptions = {}): Promise<LogModel> {
    if (!id) {
      throw new Error('Missing required log id.');
    }

    return this.client.send<LogModel>(`/api/logs/${encodeURIComponent(id)}`, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Returns logs statistics.
   */
  async getStats(options: ListOptions = {}): Promise<LogStatsEntry[]> {
    return this.client.send<LogStatsEntry[]>('/api/logs/stats', {
      method: 'GET',
      ...options,
      query: this.extractQueryParams(options),
    });
  }

  /**
   * Extracts query parameters from options.
   */
  private extractQueryParams(
    options: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const knownNonQueryParams = [
      'headers',
      'body',
      'query',
      'requestKey',
      'fetch',
      'method',
    ];

    for (const [key, value] of Object.entries(options)) {
      if (knownNonQueryParams.includes(key) || value === undefined) {
        continue;
      }
      result[key] = value;
    }

    if (options.query && typeof options.query === 'object') {
      Object.assign(result, options.query);
    }

    return result;
  }
}
