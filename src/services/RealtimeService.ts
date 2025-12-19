import { BaseService } from './BaseService';
import type { Client } from '../Client';
import type { SendOptions } from '../tools/options';
import { ClientResponseError } from '../ClientResponseError';

/**
 * Subscription callback type.
 */
export type SubscriptionFunc = (data: Record<string, unknown>) => void;

/**
 * Connect event name constant.
 */
export const PB_CONNECT = 'PB_CONNECT';

interface Subscription {
  topic: string;
  callback: SubscriptionFunc;
  options?: SendOptions;
}

/**
 * RealtimeService handles SSE subscriptions for realtime updates.
 */
export class RealtimeService extends BaseService {
  private eventSource: EventSource | null = null;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private clientId: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectIntervalMs = 3000;
  private pendingConnects: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];

  /**
   * Optional hook invoked when the realtime connection disconnects.
   */
  onDisconnect?: (subscriptions: string[]) => void;

  constructor(client: Client) {
    super(client);
  }

  /**
   * Returns whether the realtime connection is established.
   */
  get isConnected(): boolean {
    return (
      !!this.eventSource &&
      this.eventSource.readyState === EventSource.OPEN &&
      !!this.clientId
    );
  }

  /**
   * Subscribes to a topic.
   */
  async subscribe(
    topic: string,
    callback: SubscriptionFunc,
    options: SendOptions = {}
  ): Promise<() => Promise<void>> {
    if (!topic) {
      throw new Error('Topic is required.');
    }

    // Register the subscription
    const subscription: Subscription = { topic, callback, options };
    const topicSubs = this.subscriptions.get(topic) || [];
    topicSubs.push(subscription);
    this.subscriptions.set(topic, topicSubs);

    // Connect if not already connected
    await this.connect();

    // Submit the subscription to the server
    await this.submitSubscriptions();

    // Return unsubscribe function
    return async () => {
      await this.unsubscribeByTopicAndListener(topic, callback);
    };
  }

  /**
   * Unsubscribes from a topic (removes all listeners for that topic).
   */
  async unsubscribe(topic?: string): Promise<void> {
    if (!topic) {
      // Unsubscribe from all
      this.subscriptions.clear();
    } else {
      this.subscriptions.delete(topic);
    }

    if (this.subscriptions.size === 0) {
      this.disconnect();
    } else {
      await this.submitSubscriptions();
    }
  }

  /**
   * Unsubscribes from all topics starting with the given prefix.
   */
  async unsubscribeByPrefix(topicPrefix: string): Promise<void> {
    for (const topic of this.subscriptions.keys()) {
      if (topic.startsWith(topicPrefix)) {
        this.subscriptions.delete(topic);
      }
    }

    if (this.subscriptions.size === 0) {
      this.disconnect();
    } else {
      await this.submitSubscriptions();
    }
  }

  /**
   * Unsubscribes a specific callback from a topic.
   */
  async unsubscribeByTopicAndListener(
    topic: string,
    callback: SubscriptionFunc
  ): Promise<void> {
    const topicSubs = this.subscriptions.get(topic);
    if (!topicSubs) {
      return;
    }

    const filtered = topicSubs.filter((s) => s.callback !== callback);

    if (filtered.length === 0) {
      this.subscriptions.delete(topic);
    } else {
      this.subscriptions.set(topic, filtered);
    }

    if (this.subscriptions.size === 0) {
      this.disconnect();
    } else {
      await this.submitSubscriptions();
    }
  }

  /**
   * Establishes the SSE connection.
   */
  private async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // If already connecting, wait for it
    if (this.eventSource && this.eventSource.readyState === EventSource.CONNECTING) {
      return new Promise((resolve, reject) => {
        this.pendingConnects.push({ resolve, reject });
      });
    }

    return new Promise((resolve, reject) => {
      this.pendingConnects.push({ resolve, reject });

      // Create new EventSource
      const url = this.client.buildURL('/api/realtime');

      if (typeof EventSource === 'undefined') {
        const err = new Error(
          'EventSource is not available. Please use a polyfill.'
        );
        this.rejectPendingConnects(err);
        return;
      }

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = () => {
        this.handleDisconnect();
      };

      this.eventSource.addEventListener('PB_CONNECT', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { clientId: string };
          this.clientId = data.clientId;

          // Notify PB_CONNECT subscribers
          const connectSubs = this.subscriptions.get(PB_CONNECT);
          if (connectSubs) {
            for (const sub of connectSubs) {
              sub.callback(data);
            }
          }

          this.resolvePendingConnects();
        } catch (err) {
          this.rejectPendingConnects(err as Error);
        }
      });

      // Listen for messages
      this.eventSource.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as Record<string, unknown>;
          const topic = data.topic as string;

          if (!topic) {
            return;
          }

          const topicSubs = this.subscriptions.get(topic);
          if (topicSubs) {
            for (const sub of topicSubs) {
              sub.callback(data);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };
    });
  }

  /**
   * Disconnects the SSE connection.
   */
  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const activeTopics = Array.from(this.subscriptions.keys());
    this.clientId = '';

    if (this.onDisconnect && activeTopics.length > 0) {
      this.onDisconnect(activeTopics);
    }
  }

  /**
   * Handles disconnection and potential reconnection.
   */
  private handleDisconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.disconnect();
      return;
    }

    this.reconnectAttempts++;

    // Attempt to reconnect after a delay
    setTimeout(() => {
      if (this.subscriptions.size > 0) {
        this.eventSource?.close();
        this.eventSource = null;
        this.clientId = '';
        this.connect().then(() => this.submitSubscriptions());
      }
    }, this.reconnectIntervalMs);
  }

  /**
   * Submits current subscriptions to the server.
   */
  private async submitSubscriptions(): Promise<void> {
    if (!this.clientId) {
      return;
    }

    const topics = Array.from(this.subscriptions.keys()).filter(
      (t) => t !== PB_CONNECT
    );

    try {
      await this.client.send('/api/realtime', {
        method: 'POST',
        body: {
          clientId: this.clientId,
          subscriptions: topics,
        },
        requestKey: null, // Disable auto-cancellation
      });
    } catch (err) {
      if (!(err instanceof ClientResponseError) || !err.isAbort) {
        throw err;
      }
    }
  }

  /**
   * Resolves all pending connect promises.
   */
  private resolvePendingConnects(): void {
    for (const pending of this.pendingConnects) {
      pending.resolve();
    }
    this.pendingConnects = [];
  }

  /**
   * Rejects all pending connect promises.
   */
  private rejectPendingConnects(err: Error): void {
    for (const pending of this.pendingConnects) {
      pending.reject(err);
    }
    this.pendingConnects = [];
  }
}
