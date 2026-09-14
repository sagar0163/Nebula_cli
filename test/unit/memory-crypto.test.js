import { describe, it, expect, beforeEach } from 'vitest';
import { encryptObject, decryptObject, isEncryptionEnabled, isLocalFirst } from '../../src/utils/memory-crypto.js';

describe('memory-crypto', () => {
  const originalKey = process.env.NEBULA_MEMORY_KEY;
  const originalEncryption = process.env.NEBULA_MEMORY_ENCRYPTION;
  const originalSync = process.env.NEBULA_MEMORY_SYNC;

  beforeEach(() => {
    delete process.env.NEBULA_MEMORY_KEY;
    delete process.env.NEBULA_MEMORY_ENCRYPTION;
    delete process.env.NEBULA_MEMORY_SYNC;
  });

  afterEach(() => {
    if (originalKey) process.env.NEBULA_MEMORY_KEY = originalKey;
    else delete process.env.NEBULA_MEMORY_KEY;
    if (originalEncryption) process.env.NEBULA_MEMORY_ENCRYPTION = originalEncryption;
    else delete process.env.NEBULA_MEMORY_ENCRYPTION;
    if (originalSync) process.env.NEBULA_MEMORY_SYNC = originalSync;
    else delete process.env.NEBULA_MEMORY_SYNC;
  });

  it('should default to encryption enabled', () => {
    expect(isEncryptionEnabled()).toBe(true);
  });

  it('should allow disabling encryption via env', () => {
    process.env.NEBULA_MEMORY_ENCRYPTION = 'false';
    expect(isEncryptionEnabled()).toBe(false);
  });

  it('should default to local-first (no cloud sync)', () => {
    expect(isLocalFirst()).toBe(true);
  });

  it('should encrypt and round-trip an object', () => {
    const payload = { projectFixes: { abc: [{ command: 'npm test', fix: 'npm ci' }] }, version: '4.3' };
    const encrypted = encryptObject(payload);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('npm test');

    const decrypted = decryptObject(encrypted);
    expect(decrypted).toEqual(payload);
  });

  it('should pass through plaintext JSON that is not encrypted (legacy support)', () => {
    const legacy = JSON.stringify({ projectFixes: {}, globalFixes: [] });
    expect(decryptObject(legacy)).toEqual({ projectFixes: {}, globalFixes: [] });
  });
});