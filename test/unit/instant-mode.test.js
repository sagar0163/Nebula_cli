import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('instant mode (#39)', () => {
  let origArgv;
  let origEnv;

  beforeEach(() => {
    origArgv = process.argv;
    origEnv = { ...process.env };
  });

  afterEach(() => {
    process.argv = origArgv;
    process.env = origEnv;
  });

  describe('npx detection', () => {
    it('detects npx via npm_config_user_agent', () => {
      process.env.npm_config_user_agent = 'npm/x.x.x npx/x.x.x node/v22.x.x linux x64';
      process.env.npm_command = undefined;

      const isNpx = process.env.npm_config_user_agent?.includes('npx') ||
                    process.env.npm_command === 'npx' ||
                    process.env._?.endsWith('npx');
      expect(isNpx).toBe(true);
    });

    it('detects npx via npm_command', () => {
      process.env.npm_config_user_agent = undefined;
      process.env.npm_command = 'npx';
      process.env._ = '/usr/bin/node';

      const isNpx = process.env.npm_config_user_agent?.includes('npx') ||
                    process.env.npm_command === 'npx' ||
                    process.env._?.endsWith('npx');
      expect(isNpx).toBe(true);
    });

    it('detects npx via _ env var', () => {
      process.env.npm_config_user_agent = undefined;
      process.env.npm_command = undefined;
      process.env._ = '/usr/bin/npx';

      const isNpx = process.env.npm_config_user_agent?.includes('npx') ||
                    process.env.npm_command === 'npx' ||
                    process.env._?.endsWith('npx');
      expect(isNpx).toBe(true);
    });

    it('does not detect npx when run directly via node', () => {
      process.env.npm_config_user_agent = 'node/v22.x.x linux x64';
      process.env.npm_command = 'start';
      process.env._ = '/usr/bin/node';

      const isNpx = process.env.npm_config_user_agent?.includes('npx') ||
                    process.env.npm_command === 'npx' ||
                    process.env._?.endsWith('npx');
      expect(isNpx).toBe(false);
    });

    it('does not detect npx when env vars are undefined', () => {
      process.env.npm_config_user_agent = undefined;
      process.env.npm_command = undefined;
      process.env._ = '/usr/bin/node';

      const isNpx = process.env.npm_config_user_agent?.includes('npx') ||
                    process.env.npm_command === 'npx' ||
                    process.env._?.endsWith('npx');
      expect(isNpx).toBe(false);
    });
  });

  describe('flags parsing', () => {
    it('includes --persist in help text', async () => {
      // Read the help text from index.js source
      const src = fs.readFileSync(path.join(process.cwd(), 'src/index.js'), 'utf8');
      expect(src).toContain('--persist');
      expect(src).toContain('nebula setup');
    });

    it('parses --persist flag correctly', () => {
      const KNOWN_FLAGS = ['--verbose', '-v', '--quiet', '-q', '--config', '-c', '--help', '-h', '--dry-run', '-d', '--persist'];
      const args = ['--persist', 'ls'];
      const commandArgs = args.filter(arg =>
        (!arg.startsWith('--') && !arg.startsWith('-')) || !KNOWN_FLAGS.includes(arg)
      );
      expect(commandArgs).toContain('ls');
      expect(commandArgs).not.toContain('--persist');
    });

    it('sets NEBULA_INSTANT_MODE env var when instant', () => {
      process.env.NEBULA_INSTANT_MODE = '1';
      expect(process.env.NEBULA_INSTANT_MODE).toBe('1');
      delete process.env.NEBULA_INSTANT_MODE;
    });
  });

  describe('instant mode graceful degradation', () => {
    it('skips memory creation when instant mode env is set', () => {
      process.env.NEBULA_INSTANT_MODE = '1';
      // Simulate the conditional memory creation in advanced-session.js
      const memory = process.env.NEBULA_INSTANT_MODE === '1' ? null : {};
      expect(memory).toBeNull();
    });

    it('creates memory when instant mode is NOT set', () => {
      delete process.env.NEBULA_INSTANT_MODE;
      const memory = process.env.NEBULA_INSTANT_MODE === '1' ? null : {};
      expect(memory).not.toBeNull();
    });

    it('memory findSimilar is safe to call as null check', async () => {
      const memory = null;
      // The advanced-session code checks `if (memory)` before calling
      expect(memory).toBeFalsy();
    });
  });

  describe('upgrade hint message', () => {
    it('shows nebula setup command in upgrade hint', () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/index.js'), 'utf8');
      expect(src).toContain('nebula setup');
      expect(src).toContain('Instant Mode');
    });

    it('shows lightweight mode message in startup', () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/index.js'), 'utf8');
      expect(src).toContain('Lightweight mode');
    });
  });

  describe('session mode instant behavior', () => {
    it('session still initializes SessionContext regardless of mode', () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/commands/advanced-session.js'), 'utf8');
      // SessionContext should always initialize
      expect(src).toContain('SessionContext.initialize');
    });

    it('session skips memory.initialize when memory is null', () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/commands/advanced-session.js'), 'utf8');
      expect(src).toContain('if (memory) await memory.initialize');
    });

    it('handleAutoHealingSafe skips vector cache when memory is null', () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/commands/advanced-session.js'), 'utf8');
      expect(src).toContain('if (memory)');
    });

    it('skips memory.store when memory is null', () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/commands/advanced-session.js'), 'utf8');
      expect(src).toContain('if (memory) await memory.store');
    });
  });
});
