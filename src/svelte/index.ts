/**
 * Svelte-specific utilities for PocketBase SDK.
 *
 * These helpers provide idiomatic Svelte integration with reactive stores
 * and automatic cleanup for subscriptions.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createPocketBase, realtimeStore } from 'pocketbase/svelte';
 *
 *   const { pb, user } = createPocketBase('http://127.0.0.1:8090');
 *
 *   // Reactive user store
 *   $: console.log('User:', $user);
 *
 *   // Reactive collection subscription
 *   const posts = realtimeStore(pb, 'posts');
 * </script>
 *
 * {#each $posts as post}
 *   <article>{post.title}</article>
 * {/each}
 * ```
 */

import PocketBase from '../PocketBase';
import type { RecordModel, RecordSubscription, ListResult } from '../types';
import type { AuthStoreState, Subscriber, Unsubscriber } from '../stores/BaseAuthStore';
import type { ListOptions } from '../tools/options';

/**
 * Svelte readable store interface.
 */
export interface Readable<T> {
  subscribe(run: Subscriber<T>): Unsubscriber;
}

/**
 * Options for creating a PocketBase instance with Svelte integration.
 */
export interface CreatePocketBaseOptions {
  /**
   * Initial auth data to load (e.g., from SSR cookie).
   */
  initialAuth?: {
    token: string;
    record: RecordModel | null;
  };
}

/**
 * Result of createPocketBase.
 */
export interface PocketBaseContext {
  /**
   * The PocketBase client instance.
   */
  pb: PocketBase;

  /**
   * Reactive auth store that works with Svelte's $ syntax.
   */
  user: Readable<RecordModel | null>;

  /**
   * Reactive auth state store with full state info.
   */
  authState: Readable<AuthStoreState>;
}

/**
 * Creates a PocketBase client with Svelte-compatible reactive stores.
 *
 * @param url - The PocketBase server URL
 * @param options - Optional configuration
 * @returns PocketBase client and reactive stores
 *
 * @example
 * ```typescript
 * // lib/pocketbase.ts
 * import { createPocketBase } from 'pocketbase/svelte';
 *
 * export const { pb, user, authState } = createPocketBase('http://127.0.0.1:8090');
 * ```
 *
 * ```svelte
 * <script>
 *   import { pb, user } from '$lib/pocketbase';
 *
 *   async function login() {
 *     await pb.collection('users').authWithPassword(email, password);
 *     // $user automatically updates!
 *   }
 * </script>
 *
 * {#if $user}
 *   <p>Welcome, {$user.email}</p>
 * {:else}
 *   <button on:click={login}>Login</button>
 * {/if}
 * ```
 */
export function createPocketBase(
  url: string,
  options: CreatePocketBaseOptions = {}
): PocketBaseContext {
  const pb = new PocketBase(url);

  // Load initial auth if provided (SSR)
  if (options.initialAuth) {
    pb.authStore.save(options.initialAuth.token, options.initialAuth.record);
  }

  // Create user store (just the record)
  const user: Readable<RecordModel | null> = {
    subscribe(run: Subscriber<RecordModel | null>): Unsubscriber {
      run(pb.authStore.record);
      return pb.authStore.onChange((_, record) => run(record));
    },
  };

  // Create full auth state store
  const authState: Readable<AuthStoreState> = {
    subscribe: (run) => pb.authStore.subscribe(run),
  };

  return { pb, user, authState };
}

/**
 * Options for realtime store.
 */
export interface RealtimeStoreOptions<T extends RecordModel> extends ListOptions {
  /**
   * Initial records to populate the store with.
   */
  initialRecords?: T[];

  /**
   * Whether to fetch initial records on creation.
   * @default true
   */
  fetchInitial?: boolean;

  /**
   * Callback when an error occurs.
   */
  onError?: (error: Error) => void;
}

/**
 * Creates a reactive store that subscribes to realtime collection updates.
 *
 * The store automatically handles:
 * - Initial data fetching (optional)
 * - Create/update/delete events
 * - Cleanup on unsubscribe
 *
 * @param pb - PocketBase client instance
 * @param collection - Collection name or ID
 * @param options - Store options
 * @returns Readable store of records
 *
 * @example
 * ```svelte
 * <script>
 *   import { pb } from '$lib/pocketbase';
 *   import { realtimeStore } from 'pocketbase/svelte';
 *
 *   // Automatically subscribes and updates on changes
 *   const posts = realtimeStore(pb, 'posts', {
 *     sort: '-created',
 *     filter: 'published = true',
 *   });
 * </script>
 *
 * {#each $posts as post (post.id)}
 *   <article>
 *     <h2>{post.title}</h2>
 *     <p>{post.content}</p>
 *   </article>
 * {/each}
 * ```
 */
export function realtimeStore<T extends RecordModel = RecordModel>(
  pb: PocketBase,
  collection: string,
  options: RealtimeStoreOptions<T> = {}
): Readable<T[]> {
  const { initialRecords = [], fetchInitial = true, onError, ...listOptions } = options;

  let records: T[] = [...initialRecords];
  const subscribers = new Set<Subscriber<T[]>>();
  let unsubscribeRealtime: (() => Promise<void>) | null = null;
  let initialized = false;

  function notify() {
    for (const subscriber of subscribers) {
      subscriber(records);
    }
  }

  function handleRealtimeEvent(e: RecordSubscription<T>) {
    switch (e.action) {
      case 'create':
        records = [...records, e.record];
        break;
      case 'update':
        records = records.map((r) => (r.id === e.record.id ? e.record : r));
        break;
      case 'delete':
        records = records.filter((r) => r.id !== e.record.id);
        break;
    }
    notify();
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;

    try {
      // Fetch initial records
      if (fetchInitial && records.length === 0) {
        const result = await pb.collection(collection).getFullList<T>(listOptions);
        records = result;
        notify();
      }

      // Subscribe to realtime updates
      unsubscribeRealtime = await pb
        .collection(collection)
        .subscribe<T>('*', handleRealtimeEvent);
    } catch (err) {
      onError?.(err as Error);
    }
  }

  function cleanup() {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
    initialized = false;
  }

  return {
    subscribe(run: Subscriber<T[]>): Unsubscriber {
      subscribers.add(run);
      run(records);

      // Initialize on first subscriber
      if (subscribers.size === 1) {
        initialize();
      }

      return () => {
        subscribers.delete(run);

        // Cleanup when no more subscribers
        if (subscribers.size === 0) {
          cleanup();
        }
      };
    },
  };
}

/**
 * Creates a reactive store for a single record with realtime updates.
 *
 * @param pb - PocketBase client instance
 * @param collection - Collection name or ID
 * @param recordId - Record ID to watch
 * @param options - Additional options
 * @returns Readable store of the record (or null if not found/deleted)
 *
 * @example
 * ```svelte
 * <script>
 *   import { pb } from '$lib/pocketbase';
 *   import { realtimeRecord } from 'pocketbase/svelte';
 *   import { page } from '$app/stores';
 *
 *   $: post = realtimeRecord(pb, 'posts', $page.params.id);
 * </script>
 *
 * {#if $post}
 *   <h1>{$post.title}</h1>
 * {:else}
 *   <p>Loading...</p>
 * {/if}
 * ```
 */
export function realtimeRecord<T extends RecordModel = RecordModel>(
  pb: PocketBase,
  collection: string,
  recordId: string,
  options: { expand?: string; onError?: (error: Error) => void } = {}
): Readable<T | null> {
  let record: T | null = null;
  const subscribers = new Set<Subscriber<T | null>>();
  let unsubscribeRealtime: (() => Promise<void>) | null = null;
  let initialized = false;

  function notify() {
    for (const subscriber of subscribers) {
      subscriber(record);
    }
  }

  function handleRealtimeEvent(e: RecordSubscription<T>) {
    if (e.action === 'delete') {
      record = null;
    } else {
      record = e.record;
    }
    notify();
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;

    try {
      // Fetch initial record
      record = await pb.collection(collection).getOne<T>(recordId, {
        expand: options.expand,
      });
      notify();

      // Subscribe to realtime updates for this specific record
      unsubscribeRealtime = await pb
        .collection(collection)
        .subscribe<T>(recordId, handleRealtimeEvent);
    } catch (err) {
      options.onError?.(err as Error);
    }
  }

  function cleanup() {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
    initialized = false;
    record = null;
  }

  return {
    subscribe(run: Subscriber<T | null>): Unsubscriber {
      subscribers.add(run);
      run(record);

      // Initialize on first subscriber
      if (subscribers.size === 1) {
        initialize();
      }

      return () => {
        subscribers.delete(run);

        // Cleanup when no more subscribers
        if (subscribers.size === 0) {
          cleanup();
        }
      };
    },
  };
}

// Re-export main SDK for convenience
export { default as PocketBase } from '../PocketBase';
export * from '../types';
export { ClientResponseError } from '../ClientResponseError';

