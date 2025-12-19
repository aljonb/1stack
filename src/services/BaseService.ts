import type { Client } from '../Client';

/**
 * BaseService is the base class for all API services.
 */
export abstract class BaseService {
  protected readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }
}

