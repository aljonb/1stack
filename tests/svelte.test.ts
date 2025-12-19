import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPocketBase, realtimeStore, realtimeRecord } from '../src/svelte';
import { LocalAuthStore } from '../src/stores/LocalAuthStore';
import type { RecordModel } from '../src/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Svelte Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('createPocketBase', () => {
    it('should create a PocketBase instance with reactive stores', () => {
      const { pb, user, authState } = createPocketBase('http://127.0.0.1:8090');

      expect(pb).toBeDefined();
      expect(pb.baseURL).toBe('http://127.0.0.1:8090');
      expect(user).toBeDefined();
      expect(authState).toBeDefined();
    });

    it('should have a subscribe method on user store', () => {
      const { user } = createPocketBase('http://127.0.0.1:8090');

      expect(typeof user.subscribe).toBe('function');
    });

    it('should have a subscribe method on authState store', () => {
      const { authState } = createPocketBase('http://127.0.0.1:8090');

      expect(typeof authState.subscribe).toBe('function');
    });

    it('user store should immediately call subscriber with current value', () => {
      const { user } = createPocketBase('http://127.0.0.1:8090');
      const callback = vi.fn();

      user.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(null); // No user initially
    });

    it('authState store should immediately call subscriber with current state', () => {
      const { authState } = createPocketBase('http://127.0.0.1:8090');
      const callback = vi.fn();

      authState.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        token: '',
        record: null,
        isValid: false,
        isSuperuser: false,
      });
    });

    it('should update user store when auth changes', () => {
      const { pb, user } = createPocketBase('http://127.0.0.1:8090');
      const callback = vi.fn();

      user.subscribe(callback);

      const record: RecordModel = {
        id: '123',
        collectionId: 'users',
        collectionName: 'users',
        created: '2024-01-01',
        updated: '2024-01-01',
        email: 'test@example.com',
      };

      pb.authStore.save('test-token', record);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(record);
    });

    it('should load initial auth if provided', () => {
      const record: RecordModel = {
        id: '456',
        collectionId: 'users',
        collectionName: 'users',
        created: '',
        updated: '',
      };

      const { pb, user } = createPocketBase('http://127.0.0.1:8090', {
        initialAuth: {
          token: 'initial-token',
          record,
        },
      });

      const callback = vi.fn();
      user.subscribe(callback);

      expect(pb.authStore.token).toBe('initial-token');
      expect(callback).toHaveBeenCalledWith(record);
    });

    it('should return unsubscribe function from user store', () => {
      const { pb, user } = createPocketBase('http://127.0.0.1:8090');
      const callback = vi.fn();

      const unsubscribe = user.subscribe(callback);
      expect(typeof unsubscribe).toBe('function');

      // Unsubscribe
      unsubscribe();

      // Should not be called again after unsubscribe
      pb.authStore.save('new-token', null);
      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe('BaseAuthStore Svelte compatibility', () => {
    it('should implement Svelte store contract', () => {
      const store = new LocalAuthStore();

      expect(typeof store.subscribe).toBe('function');
    });

    it('subscribe should immediately invoke with current state', () => {
      const store = new LocalAuthStore();
      const callback = vi.fn();

      store.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        token: '',
        record: null,
        isValid: false,
        isSuperuser: false,
      });
    });

    it('subscribe should notify on changes', () => {
      const store = new LocalAuthStore();
      const callback = vi.fn();

      store.subscribe(callback);

      const record: RecordModel = {
        id: '789',
        collectionId: 'users',
        collectionName: 'users',
        created: '',
        updated: '',
      };

      store.save('new-token', record);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          token: 'new-token',
          record: record,
        })
      );
    });

    it('subscribe should return unsubscribe function', () => {
      const store = new LocalAuthStore();
      const callback = vi.fn();

      const unsubscribe = store.subscribe(callback);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      store.save('another-token', null);
      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });

    it('multiple subscribers should all be notified', () => {
      const store = new LocalAuthStore();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      store.subscribe(callback1);
      store.subscribe(callback2);

      store.save('multi-token', null);

      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
    });
  });

  describe('realtimeStore', () => {
    it('should return a store with subscribe method', () => {
      const { pb } = createPocketBase('http://127.0.0.1:8090');
      const store = realtimeStore(pb, 'posts', { fetchInitial: false });

      expect(typeof store.subscribe).toBe('function');
    });

    it('should immediately call subscriber with empty array', () => {
      const { pb } = createPocketBase('http://127.0.0.1:8090');
      const store = realtimeStore(pb, 'posts', { fetchInitial: false });
      const callback = vi.fn();

      store.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should use initial records if provided', () => {
      const { pb } = createPocketBase('http://127.0.0.1:8090');
      const initialRecords = [
        { id: '1', collectionId: 'posts', collectionName: 'posts', created: '', updated: '', title: 'Post 1' },
      ];

      const store = realtimeStore(pb, 'posts', {
        fetchInitial: false,
        initialRecords: initialRecords as RecordModel[],
      });

      const callback = vi.fn();
      store.subscribe(callback);

      expect(callback).toHaveBeenCalledWith(initialRecords);
    });

    it('should cleanup on last unsubscribe', () => {
      const { pb } = createPocketBase('http://127.0.0.1:8090');
      const store = realtimeStore(pb, 'posts', { fetchInitial: false });

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = store.subscribe(callback1);
      const unsub2 = store.subscribe(callback2);

      unsub1();
      unsub2();

      // After both unsubscribe, store should be cleaned up
      // (no error means success)
    });
  });

  describe('realtimeRecord', () => {
    it('should return a store with subscribe method', () => {
      const { pb } = createPocketBase('http://127.0.0.1:8090');
      const store = realtimeRecord(pb, 'posts', '123');

      expect(typeof store.subscribe).toBe('function');
    });

    it('should immediately call subscriber with null', () => {
      const { pb } = createPocketBase('http://127.0.0.1:8090');
      const store = realtimeRecord(pb, 'posts', '123');
      const callback = vi.fn();

      store.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(null);
    });
  });
});

