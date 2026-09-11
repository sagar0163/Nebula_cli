import { describe, it, expect } from 'vitest';
import { CodeSandbox, isDockerAvailable } from '../../src/services/code-sandbox.js';

describe('code-sandbox', () => {
  it('should report docker availability as boolean', () => {
    const available = isDockerAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should create a sandbox instance', () => {
    const sandbox = new CodeSandbox({ useDocker: false });
    expect(sandbox).toBeDefined();
    expect(typeof sandbox.execute).toBe('function');
  });

  it('should support common languages', () => {
    const sandbox = new CodeSandbox();
    ['javascript', 'python', 'bash', 'typescript', 'go'].forEach((lang) => {
      expect(sandbox.isSupported(lang)).toBe(true);
    });
    expect(sandbox.isSupported('rust')).toBe(false);
  });

  it('should execute javascript code locally', async () => {
    const sandbox = new CodeSandbox({ useDocker: false, timeout: 30000 });
    const result = await sandbox.execute('console.log("hello-sandbox")', 'javascript');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello-sandbox');
    expect(result.sandbox).toBe('local');
  });

  it('should block dangerous code patterns', async () => {
    const sandbox = new CodeSandbox({ useDocker: false });
    await expect(sandbox.execute('rm -rf /', 'bash')).rejects.toThrow('Security violation');
  });

  it('should execute bash locally', async () => {
    const sandbox = new CodeSandbox({ useDocker: false, timeout: 30000 });
    const result = await sandbox.execute('echo "bash-ok"', 'bash');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('bash-ok');
  });
});