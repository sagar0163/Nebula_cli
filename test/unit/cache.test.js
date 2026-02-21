import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticCache } from '../../src/utils/cache.js';

describe('cache', () => {
  describe('SemanticCache', () => {
    let cache;

    beforeEach(() => {
      cache = new SemanticCache();
    });

    it('should create a cache instance', () => {
      expect(cache).toBeDefined();
    });

    it('should have get and set methods', () => {
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
    });

    it('should store and retrieve fixes', () => {
      const command = 'npm install';
      const error = 'ENOENT: no such file or directory';
      const fix = 'npm install --legacy-peer-deps';

      cache.set(command, error, fix);
      const retrieved = cache.get(command, error);

      expect(retrieved).toBe(fix);
    });

    it('should return null for non-existent entries', () => {
      const result = cache.get('nonexistent', 'nonexistent error');
      expect(result).toBeNull();
    });
  });
});
