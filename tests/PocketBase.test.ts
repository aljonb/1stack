import { describe, it, expect, vi, beforeEach } from 'vitest';
import PocketBase from '../src/PocketBase';
import { ClientResponseError } from '../src/ClientResponseError';

describe('PocketBase', () => {
  let pb: PocketBase;

  beforeEach(() => {
    pb = new PocketBase('http://127.0.0.1:8090');
  });

  describe('constructor', () => {
    it('should set the base URL', () => {
      expect(pb.baseURL).toBe('http://127.0.0.1:8090');
    });

    it('should remove trailing slashes from base URL', () => {
      const client = new PocketBase('http://example.com///');
      expect(client.baseURL).toBe('http://example.com');
    });

    it('should initialize services', () => {
      expect(pb.files).toBeDefined();
      expect(pb.collections).toBeDefined();
      expect(pb.logs).toBeDefined();
      expect(pb.settings).toBeDefined();
      expect(pb.backups).toBeDefined();
      expect(pb.crons).toBeDefined();
      expect(pb.health).toBeDefined();
      expect(pb.realtime).toBeDefined();
    });

    it('should initialize auth store', () => {
      expect(pb.authStore).toBeDefined();
      expect(pb.authStore.token).toBe('');
      expect(pb.authStore.record).toBeNull();
    });
  });

  describe('buildURL', () => {
    it('should build URL with path', () => {
      expect(pb.buildURL('/api/test')).toBe('http://127.0.0.1:8090/api/test');
    });

    it('should handle path without leading slash', () => {
      expect(pb.buildURL('api/test')).toBe('http://127.0.0.1:8090/api/test');
    });

    it('should handle empty path', () => {
      expect(pb.buildURL('')).toBe('http://127.0.0.1:8090');
    });
  });

  describe('collection', () => {
    it('should return a RecordService', () => {
      const service = pb.collection('users');
      expect(service).toBeDefined();
      expect(service.collectionIdOrName).toBe('users');
    });

    it('should cache and reuse RecordService instances', () => {
      const service1 = pb.collection('users');
      const service2 = pb.collection('users');
      expect(service1).toBe(service2);
    });
  });

  describe('filter', () => {
    it('should return expression unchanged with no params', () => {
      expect(pb.filter('name = "test"')).toBe('name = "test"');
    });

    it('should replace string placeholders', () => {
      const result = pb.filter('name = {:name}', { name: 'test' });
      expect(result).toBe("name = 'test'");
    });

    it('should escape single quotes in strings', () => {
      const result = pb.filter('name = {:name}', { name: "te'st" });
      expect(result).toBe("name = 'te\\'st'");
    });

    it('should replace number placeholders', () => {
      const result = pb.filter('age = {:age}', { age: 25 });
      expect(result).toBe('age = 25');
    });

    it('should replace boolean placeholders', () => {
      const result = pb.filter('active = {:active}', { active: true });
      expect(result).toBe('active = true');
    });

    it('should replace null placeholders', () => {
      const result = pb.filter('value = {:value}', { value: null });
      expect(result).toBe('value = null');
    });

    it('should replace multiple placeholders', () => {
      const result = pb.filter('name = {:name} && age = {:age}', {
        name: 'test',
        age: 25,
      });
      expect(result).toBe("name = 'test' && age = 25");
    });

    it('should replace same placeholder multiple times', () => {
      const result = pb.filter('a = {:val} || b = {:val}', { val: 123 });
      expect(result).toBe('a = 123 || b = 123');
    });
  });

  describe('autoCancellation', () => {
    it('should return the client for chaining', () => {
      const result = pb.autoCancellation(false);
      expect(result).toBe(pb);
    });
  });

  describe('cancelAllRequests', () => {
    it('should return the client for chaining', () => {
      const result = pb.cancelAllRequests();
      expect(result).toBe(pb);
    });
  });

  describe('cancelRequest', () => {
    it('should return the client for chaining', () => {
      const result = pb.cancelRequest('test-key');
      expect(result).toBe(pb);
    });
  });

  describe('createBatch', () => {
    it('should return a BatchService', () => {
      const batch = pb.createBatch();
      expect(batch).toBeDefined();
      expect(typeof batch.collection).toBe('function');
      expect(typeof batch.send).toBe('function');
    });
  });
});

describe('ClientResponseError', () => {
  it('should create error with url and status', () => {
    const error = new ClientResponseError({
      url: 'http://example.com',
      status: 404,
    });
    expect(error.url).toBe('http://example.com');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Response status: 404');
  });

  it('should create error with message', () => {
    const error = new ClientResponseError({
      message: 'Not found',
    });
    expect(error.message).toBe('Not found');
  });

  it('should create error with response message', () => {
    const error = new ClientResponseError({
      response: { message: 'Record not found' },
    });
    expect(error.message).toBe('Record not found');
  });

  it('should handle abort errors', () => {
    const error = new ClientResponseError({
      isAbort: true,
    });
    expect(error.isAbort).toBe(true);
    expect(error.message).toBe('The request was autocancelled.');
  });

  it('should convert to JSON', () => {
    const error = new ClientResponseError({
      url: 'http://example.com',
      status: 500,
      response: { message: 'Server error' },
    });
    const json = error.toJSON();
    expect(json.url).toBe('http://example.com');
    expect(json.status).toBe(500);
    expect(json.response).toEqual({ message: 'Server error' });
  });
});

