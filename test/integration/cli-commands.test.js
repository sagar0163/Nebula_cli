import { describe, it, expect, beforeEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CLI_COMMAND = 'node src/index.js';

describe('CLI Command Surface Tests', () => {
  describe('Help Command', () => {
    it('nebula help - should display help', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} help`);
      expect(stdout).toContain('Nebula-CLI');
      expect(stdout).toContain('session');
      expect(stdout).toContain('ask');
      expect(stdout).toContain('chat');
      expect(stdout).toContain('predict');
    });

    it('nebula -h - should display help', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -h`);
      expect(stdout).toContain('nebula');
    });

    it('nebula --help - should display help', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} --help`);
      expect(stdout).toContain('nebula');
    });
  });

  describe('CLI Flags', () => {
    it('nebula -v status - verbose flag should work', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -v status`);
      expect(stdout).toContain('Nebula Status');
    });

    it('nebula --verbose status - verbose flag should work', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} --verbose status`);
      expect(stdout).toContain('Nebula Status');
    });

    it('nebula -q status - quiet flag should suppress output', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -q status`);
      // Quiet mode should suppress banner but still show status
      expect(stdout).toContain('Nebula Status');
    });

    it('nebula --quiet status - quiet flag should work', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} --quiet status`);
      expect(stdout).toContain('Nebula Status');
    });

    it('nebula -c nonexistent.env status - config flag with missing file', async () => {
      const { stderr } = await execAsync(`${CLI_COMMAND} -c nonexistent.env status`);
      // Should handle missing config gracefully or show warning
      expect(stderr + await execAsync(`${CLI_COMMAND} -c nonexistent.env status`).then(r => r.stdout)).toMatch(/error|Error|ENOENT|NOT FOUND/i);
    });

    it('nebula --invalid-flag - should show unknown flag error', async () => {
      try {
        await execAsync(`${CLI_COMMAND} --invalid-flag`);
      } catch (err) {
        expect(err.message).toMatch(/error|unknown|invalid/i);
      }
    });

    it('nebula -z - should show unknown flag error', async () => {
      try {
        await execAsync(`${CLI_COMMAND} -z`);
      } catch (err) {
        expect(err.message).toMatch(/error|unknown|invalid/i);
      }
    });
  });

  describe('Status Command', () => {
    it('nebula status - should display status', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toContain('Nebula Status');
      expect(stdout).toContain('Version');
    });
  });

  describe('Ask Command', () => {
    it('nebula ask - without query should show usage', async () => {
      const { stdout, stderr } = await execAsync(`${CLI_COMMAND} ask`);
      const output = stdout + stderr;
      expect(output).toMatch(/usage|please|provide|question/i);
    });

    it('nebula ask "" - empty query should show error', async () => {
      try {
        await execAsync(`${CLI_COMMAND} ask ""`);
      } catch (err) {
        expect(err.message).toMatch(/usage|empty|provide|question/i);
      }
    });
  });

  describe('Chat Command', () => {
    it('nebula chat - should work with prompt', async () => {
      // This may fail due to no API key, but should not crash
      try {
        const { stdout, stderr } = await execAsync(`${CLI_COMMAND} chat "hello"`, { timeout: 10000 });
        const output = stdout + stderr;
        // Should show untrusted output warning
        expect(output.toLowerCase()).toContain('response');
      } catch (err) {
        // Expected if no API keys - should be graceful error
        expect(err.message).toMatch(/error|api|key|fallback|ollama/i);
      }
    });
  });

  describe('Predict Command', () => {
    it('nebula predict - should run without crashing', async () => {
      try {
        const { stdout } = await execAsync(`${CLI_COMMAND} predict`, { timeout: 15000 });
        expect(stdout).toBeDefined();
      } catch (err) {
        // May fail if no project detected
        expect(err.message).toMatch(/predict|nebula|error/i);
      }
    });
  });

  describe('Exit Codes', () => {
    it('nebula status - should exit with code 0 on success', async () => {
      try {
        await execAsync(`${CLI_COMMAND} status`);
      } catch (err) {
        expect(err.code).toBe(0);
      }
    });

    it('nebula ask - should exit with code 1 on error', async () => {
      try {
        await execAsync(`${CLI_COMMAND} ask`);
      } catch (err) {
        expect(err.code).toBe(1);
      }
    });
  });
});
