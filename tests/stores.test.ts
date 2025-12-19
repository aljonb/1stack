import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalAuthStore } from '../src/stores/LocalAuthStore';
import { AsyncAuthStore } from '../src/stores/AsyncAuthStore';
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

describe('LocalAuthStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should initialize with empty values', () => {
    const store = new LocalAuthStore();
    expect(store.token).toBe('');
    expect(store.record).toBeNull();
    expect(store.isValid).toBe(false);
  });

  it('should save and retrieve token and record', () => {
    const store = new LocalAuthStore();
    const record: RecordModel = {
      id: '123',
      collectionId: 'users',
      collectionName: 'users',
      created: '2024-01-01',
      updated: '2024-01-01',
    };

    store.save('test-token', record);

    expect(store.token).toBe('test-token');
    expect(store.record).toEqual(record);
  });

  it('should clear the store', () => {
    const store = new LocalAuthStore();
    store.save('test-token', {
      id: '123',
      collectionId: 'users',
      collectionName: 'users',
      created: '',
      updated: '',
    });

    store.clear();

    expect(store.token).toBe('');
    expect(store.record).toBeNull();
  });

  it('should trigger onChange callbacks', () => {
    const store = new LocalAuthStore();
    const callback = vi.fn();

    store.onChange(callback);
    store.save('new-token', null);

    expect(callback).toHaveBeenCalledWith('new-token', null);
  });

  it('should fire immediately if requested', () => {
    const store = new LocalAuthStore();
    const callback = vi.fn();

    store.onChange(callback, true);

    expect(callback).toHaveBeenCalledWith('', null);
  });

  it('should remove listeners', () => {
    const store = new LocalAuthStore();
    const callback = vi.fn();

    const removeListener = store.onChange(callback);
    removeListener();

    store.save('new-token', null);

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('AsyncAuthStore', () => {
  it('should initialize with empty values', async () => {
    const store = new AsyncAuthStore({
      save: async () => {},
    });

    await store.awaitInitial();

    expect(store.token).toBe('');
    expect(store.record).toBeNull();
  });

  it('should load initial value', async () => {
    const initial = JSON.stringify({
      token: 'test-token',
      record: { id: '123', collectionId: 'users', collectionName: 'users', created: '', updated: '' },
    });

    const store = new AsyncAuthStore({
      save: async () => {},
      initial,
    });

    await store.awaitInitial();

    expect(store.token).toBe('test-token');
    expect(store.record?.id).toBe('123');
  });

  it('should load initial value from Promise', async () => {
    const initial = Promise.resolve(
      JSON.stringify({
        token: 'async-token',
        record: null,
      })
    );

    const store = new AsyncAuthStore({
      save: async () => {},
      initial,
    });

    await store.awaitInitial();

    expect(store.token).toBe('async-token');
  });

  it('should call save on token change', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const store = new AsyncAuthStore({
      save: saveFn,
    });

    store.save('new-token', null);

    // Wait for the save to be called
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saveFn).toHaveBeenCalledWith(
      JSON.stringify({ token: 'new-token', record: null })
    );
  });

  it('should call clear function when available', async () => {
    const clearFn = vi.fn().mockResolvedValue(undefined);
    const store = new AsyncAuthStore({
      save: async () => {},
      clear: clearFn,
    });

    store.clear();

    // Wait for the clear to be called
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clearFn).toHaveBeenCalled();
  });
});

describe('BaseAuthStore cookie methods', () => {
  it('should export to cookie', () => {
    const store = new LocalAuthStore();
    store.save('test-token', {
      id: '123',
      collectionId: 'users',
      collectionName: 'users',
      created: '',
      updated: '',
    });

    const cookie = store.exportToCookie();

    expect(cookie).toContain('pb_auth=');
    expect(cookie).toContain('test-token');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
  });

  it('should load from cookie', () => {
    const store = new LocalAuthStore();
    const cookieData = JSON.stringify({
      token: 'cookie-token',
      record: { id: '456', collectionId: 'users', collectionName: 'users', created: '', updated: '' },
    });
    const cookieString = `pb_auth=${encodeURIComponent(cookieData)}`;

    store.loadFromCookie(cookieString);

    expect(store.token).toBe('cookie-token');
    expect(store.record?.id).toBe('456');
  });

  it('should handle custom cookie key', () => {
    const store = new LocalAuthStore();
    const cookieData = JSON.stringify({
      token: 'custom-token',
      record: null,
    });
    const cookieString = `custom_auth=${encodeURIComponent(cookieData)}`;

    store.loadFromCookie(cookieString, 'custom_auth');

    expect(store.token).toBe('custom-token');
  });
});

