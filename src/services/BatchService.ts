import type { Client } from '../Client';
import type { BatchResult } from '../types';
import type { SendOptions } from '../tools/options';

interface BatchRequest {
  method: string;
  url: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * BatchRecordService provides batch CRUD operations for a collection.
 */
class BatchRecordService {
  private batch: BatchService;
  readonly collectionIdOrName: string;

  constructor(batch: BatchService, collectionIdOrName: string) {
    this.batch = batch;
    this.collectionIdOrName = collectionIdOrName;
  }

  /**
   * Registers a create request in the batch.
   */
  create(bodyParams: Record<string, unknown> = {}): void {
    this.batch.addRequest({
      method: 'POST',
      url: `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/records`,
      body: bodyParams,
    });
  }

  /**
   * Registers an update request in the batch.
   */
  update(recordId: string, bodyParams: Record<string, unknown> = {}): void {
    this.batch.addRequest({
      method: 'PATCH',
      url: `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/records/${encodeURIComponent(recordId)}`,
      body: bodyParams,
    });
  }

  /**
   * Registers a delete request in the batch.
   */
  delete(recordId: string): void {
    this.batch.addRequest({
      method: 'DELETE',
      url: `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/records/${encodeURIComponent(recordId)}`,
    });
  }

  /**
   * Registers an upsert request in the batch.
   */
  upsert(bodyParams: Record<string, unknown> = {}): void {
    this.batch.addRequest({
      method: 'PUT',
      url: `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/records`,
      body: bodyParams,
    });
  }
}

/**
 * BatchService handles batch/transaction requests.
 */
export class BatchService {
  private readonly client: Client;
  private requests: BatchRequest[] = [];

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Returns a batch record service for the specified collection.
   */
  collection(collectionIdOrName: string): BatchRecordService {
    return new BatchRecordService(this, collectionIdOrName);
  }

  /**
   * Adds a request to the batch.
   */
  addRequest(request: BatchRequest): void {
    this.requests.push(request);
  }

  /**
   * Sends all registered batch requests.
   */
  async send(options: SendOptions = {}): Promise<BatchResult[]> {
    if (this.requests.length === 0) {
      return [];
    }

    const result = await this.client.send<BatchResult[]>('/api/batch', {
      method: 'POST',
      ...options,
      body: { requests: this.requests },
    });

    // Clear requests after sending
    this.requests = [];

    return result;
  }
}
