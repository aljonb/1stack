import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { HealthCheckResponse } from '../types';
import type { SendOptions } from '../tools/options';

/**
 * HealthService provides health check operations.
 */
export class HealthService extends BaseService {
  constructor(client: Client) {
    super(client);
  }

  /**
   * Checks the health status of the API.
   */
  async check(options: SendOptions = {}): Promise<HealthCheckResponse> {
    return this.client.send<HealthCheckResponse>('/api/health', {
      method: 'GET',
      ...options,
    });
  }
}
