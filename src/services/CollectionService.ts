import { CrudService } from './CrudService';
import type { Client } from '../Client';
import type { CollectionModel, CollectionScaffolds } from '../types';
import type { SendOptions, CollectionImportOptions } from '../tools/options';

/**
 * CollectionService handles CRUD operations for collections.
 */
export class CollectionService extends CrudService<CollectionModel> {
  constructor(client: Client) {
    super(client);
  }

  get baseCrudPath(): string {
    return '/api/collections';
  }

  /**
   * Deletes all records associated with the specified collection.
   */
  async truncate(
    idOrName: string,
    options: SendOptions = {}
  ): Promise<boolean> {
    await this.client.send(
      `${this.baseCrudPath}/${encodeURIComponent(idOrName)}/truncate`,
      {
        method: 'DELETE',
        ...options,
      }
    );
    return true;
  }

  /**
   * Imports the provided collections.
   */
  async import(
    collections: CollectionModel[],
    deleteMissing = false,
    options: CollectionImportOptions = {}
  ): Promise<boolean> {
    await this.client.send(`${this.baseCrudPath}/import`, {
      method: 'PUT',
      ...options,
      body: {
        collections,
        deleteMissing,
      },
    });
    return true;
  }

  /**
   * Returns type indexed map with scaffolded collection models.
   */
  async getScaffolds(
    options: SendOptions = {}
  ): Promise<CollectionScaffolds> {
    return this.client.send<CollectionScaffolds>(
      `${this.baseCrudPath}/meta/scaffolds`,
      {
        method: 'GET',
        ...options,
      }
    );
  }
}
