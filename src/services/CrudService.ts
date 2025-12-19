import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { ListResult, BaseModel } from '../types';
import type {
  ListOptions,
  FullListOptions,
  RecordOptions,
  SendOptions,
} from '../tools/options';

/**
 * CrudService provides common CRUD operations for a resource.
 */
export abstract class CrudService<T extends BaseModel> extends BaseService {
  /**
   * Returns the base path for the service.
   */
  abstract get baseCrudPath(): string;

  constructor(client: Client) {
    super(client);
  }

  /**
   * Returns a paginated list of items.
   */
  async getList(
    page = 1,
    perPage = 30,
    options: ListOptions = {}
  ): Promise<ListResult<T>> {
    const queryParams: Record<string, unknown> = {
      page,
      perPage,
      ...this.extractQueryParams(options),
    };

    return this.client.send<ListResult<T>>(this.baseCrudPath, {
      method: 'GET',
      ...options,
      query: queryParams,
    });
  }

  /**
   * Returns a full list of items, fetching all pages.
   */
  async getFullList(options: FullListOptions = {}): Promise<T[]> {
    const batch = options.batch || 200;
    const result: T[] = [];

    const fetchPage = async (page: number): Promise<void> => {
      const listOptions: ListOptions = {
        ...options,
        requestKey: options.requestKey ?? null, // disable auto-cancellation for batch requests
      };

      const list = await this.getList(page, batch, listOptions);
      result.push(...list.items);

      if (list.items.length === batch && list.totalPages > page) {
        await fetchPage(page + 1);
      }
    };

    await fetchPage(1);

    return result;
  }

  /**
   * Returns the first found item matching the specified filter.
   */
  async getFirstListItem(
    filter: string,
    options: ListOptions = {}
  ): Promise<T> {
    const queryParams: Record<string, unknown> = {
      ...this.extractQueryParams(options),
      filter,
      skipTotal: true,
    };

    const result = await this.client.send<ListResult<T>>(this.baseCrudPath, {
      method: 'GET',
      ...options,
      query: { ...queryParams, page: 1, perPage: 1 },
    });

    if (!result.items.length) {
      throw new Error('The requested resource was not found.');
    }

    return result.items[0];
  }

  /**
   * Returns a single item by its id.
   */
  async getOne(id: string, options: RecordOptions = {}): Promise<T> {
    if (!id) {
      throw new Error('Missing required record id.');
    }

    const path = `${this.baseCrudPath}/${encodeURIComponent(id)}`;

    return this.client.send<T>(path, {
      method: 'GET',
      ...options,
      query: this.extractQueryParams(options),
    });
  }

  /**
   * Creates a new item.
   */
  async create(
    bodyParams: Record<string, unknown> = {},
    options: SendOptions = {}
  ): Promise<T> {
    return this.client.send<T>(this.baseCrudPath, {
      method: 'POST',
      ...options,
      body: bodyParams,
      query: this.extractQueryParams(options),
    });
  }

  /**
   * Updates an existing item by its id.
   */
  async update(
    id: string,
    bodyParams: Record<string, unknown> = {},
    options: SendOptions = {}
  ): Promise<T> {
    if (!id) {
      throw new Error('Missing required record id.');
    }

    const path = `${this.baseCrudPath}/${encodeURIComponent(id)}`;

    return this.client.send<T>(path, {
      method: 'PATCH',
      ...options,
      body: bodyParams,
      query: this.extractQueryParams(options),
    });
  }

  /**
   * Deletes an item by its id.
   */
  async delete(id: string, options: SendOptions = {}): Promise<boolean> {
    if (!id) {
      throw new Error('Missing required record id.');
    }

    const path = `${this.baseCrudPath}/${encodeURIComponent(id)}`;

    await this.client.send(path, {
      method: 'DELETE',
      ...options,
      query: this.extractQueryParams(options),
    });

    return true;
  }

  /**
   * Extracts query parameters from options.
   */
  protected extractQueryParams(
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

    // Merge explicit query params
    if (options.query && typeof options.query === 'object') {
      Object.assign(result, options.query);
    }

    return result;
  }
}

