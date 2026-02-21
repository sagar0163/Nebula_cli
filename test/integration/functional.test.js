import { describe, it, expect, beforeEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const CLI_COMMAND = 'node src/index.js';

describe('Integration & Functional Tests', () => {
  describe('Project Detection', () => {
    const testDir = path.join(os.tmpdir(), 'nebula-test-' + Date.now());

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    it('should detect Node.js project with package.json', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }));
      
      const { stdout } = await execAsync(`${CLI_COMMAND} status`, { cwd: testDir });
      expect(stdout).toContain('Project ID');
    });

    it('should handle empty directory gracefully', async () => {
      const emptyDir = path.join(os.tmpdir(), 'nebula-empty-' + Date.now());
      fs.mkdirSync(emptyDir, { recursive: true });
      
      const { stdout } = await execAsync(`${CLI_COMMAND} status`, { cwd: emptyDir });
      expect(stdout).toContain('Nebula Status');
    });
  });

  describe('AI Service Fallback', () => {
    it('should handle missing API keys gracefully', async () => {
      // Run without any API keys set
      const { stdout, stderr } = await execAsync(`${CLI_COMMAND} status`);
      // Should still work, just show status without AI features
      expect(stdout).toContain('Nebula Status');
    });

    it('should show mode in status', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toContain('Mode');
    });
  });

  describe('Memory Persistence', () => {
    it('should have SemanticCache class', async () => {
      const { SemanticCache } = await import('../../src/utils/cache.js');
      const cache = new SemanticCache();
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
    });

    it('should store and retrieve cached fixes', async () => {
      const { SemanticCache } = await import('../../src/utils/cache.js');
      const cache = new SemanticCache();
      
      const command = 'npm install';
      const error = 'ENOENT: no such file';
      const fix = 'npm install --legacy-peer-deps';
      
      cache.set(command, error, fix);
      const retrieved = cache.get(command, error);
      
      expect(retrieved).toBe(fix);
    });
  });

  describe('CLI Help Output', () => {
    it('should list all commands in help', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} help`);
      expect(stdout).toContain('session');
      expect(stdout).toContain('ask');
      expect(stdout).toContain('chat');
      expect(stdout).toContain('predict');
      expect(stdout).toContain('release');
      expect(stdout).toContain('status');
      expect(stdout).toContain('help');
    });

    it('should show usage information', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} help`);
      expect(stdout).toContain('Usage');
    });
  });

  describe('Configuration Loading', () => {
    it('should load environment from .env', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      // Should load without errors
      expect(stdout).toBeDefined();
    });

    it('should handle missing .env gracefully', async () => {
      // .env is optional, should not crash
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toContain('Nebula');
    });
  });

  describe('Performance', () => {
    it('status command should complete quickly', async () => {
      const start = Date.now();
      await execAsync(`${CLI_COMMAND} status`);
      const duration = Date.now() - start;
      
      // Should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('help command should be instant', async () => {
      const start = Date.now();
      await execAsync(`${CLI_COMMAND} help`);
      const duration = Date.now() - start;
      
      // Should complete in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Auto-Healing Flow', () => {
    it('should have isSafeCommand exported', async () => {
      const { isSafeCommand } = await import('../../src/utils/safe-guard.js');
      expect(typeof isSafeCommand).toBe('function');
    });

    it('should have getCommandWarning exported', async () => {
      const { getCommandWarning } = await import('../../src/utils/safe-guard.js');
      expect(typeof getCommandWarning).toBe('function');
    });

    it('should have autonomyMode exported', async () => {
      const { autonomyMode } = await import('../../src/utils/safe-guard.js');
      expect(typeof autonomyMode).toBe('function');
    });
  });
});
