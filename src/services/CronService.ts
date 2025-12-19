import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { CronJob } from '../types';
import type { SendOptions } from '../tools/options';

/**
 * CronService provides cron job operations.
 */
export class CronService extends BaseService {
  constructor(client: Client) {
    super(client);
  }

  /**
   * Returns list with all available cron jobs.
   */
  async getFullList(options: SendOptions = {}): Promise<CronJob[]> {
    return this.client.send<CronJob[]>('/api/crons', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Runs the specified cron job.
   */
  async run(jobId: string, options: SendOptions = {}): Promise<boolean> {
    await this.client.send(`/api/crons/${encodeURIComponent(jobId)}`, {
      method: 'POST',
      ...options,
    });
    return true;
  }
}
