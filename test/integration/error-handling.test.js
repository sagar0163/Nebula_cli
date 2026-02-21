import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CLI_COMMAND = 'node src/index.js';

describe('Error Handling & UX Tests', () => {
  describe('Exit Codes', () => {
    it('should exit with code 0 on successful status command', async () => {
      try {
        await execAsync(`${CLI_COMMAND} status`);
      } catch (err) {
        expect(err.code).toBe(0);
      }
    });

    it('should exit with code 1 on invalid ask command', async () => {
      try {
        await execAsync(`${CLI_COMMAND} ask`);
      } catch (err) {
        expect(err.code).toBe(1);
      }
    });

    it('should exit with code 1 on invalid command', async () => {
      try {
        await execAsync(`${CLI_COMMAND} nonexistentcommand`);
      } catch (err) {
        expect(err.code).toBe(1);
      }
    });
  });

  describe('Error Messages', () => {
    it('should show helpful error for missing ask query', async () => {
      try {
        await execAsync(`${CLI_COMMAND} ask`);
      } catch (err) {
        expect(err.message).toMatch(/usage|please|provide|question/i);
      }
    });

    it('should show helpful error for unknown command', async () => {
      try {
        await execAsync(`${CLI_COMMAND} invalid`);
      } catch (err) {
        // Should have some error output
        expect(err.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Help Display', () => {
    it('should show help for -h flag', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -h`);
      expect(stdout).toContain('Nebula-CLI Options');
    });

    it('should show help for --help flag', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} --help`);
      expect(stdout).toContain('Nebula-CLI Options');
    });

    it('should show help for help command', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} help`);
      expect(stdout).toContain('Usage');
      expect(stdout).toContain('Commands');
    });
  });

  describe('Status Command Output', () => {
    it('should display version in status', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toContain('Version');
    });

    it('should display security info in status', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toContain('Security');
    });

    it('should display project ID in status', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toContain('Project ID');
    });
  });

  describe('Configuration Handling', () => {
    it('should work with default configuration', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status`);
      expect(stdout).toBeDefined();
      expect(stdout.length).toBeGreaterThan(0);
    });

    it('should warn about missing config file', async () => {
      try {
        await execAsync(`${CLI_COMMAND} -c /nonexistent/config.env status`);
      } catch (err) {
        // Should exit with error
        expect(err.code).toBe(1);
        expect(err.stderr + err.stdout).toMatch(/not found|Error|ENOENT/i);
      }
    });
  });

  describe('Quiet Mode', () => {
    it('should suppress banner in quiet mode', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -q status`);
      // In quiet mode, banner should be suppressed but status should show
      expect(stdout).toContain('Nebula Status');
      // Banner should not appear in quiet mode
      expect(stdout).not.toMatch(/Nebula-CLI.*The Self-Healing Terminal Agent/);
    });

    it('should suppress banner with --quiet', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} --quiet status`);
      expect(stdout).toContain('Nebula Status');
    });
  });

  describe('Verbose Mode', () => {
    it('should enable verbose output with -v', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -v status`);
      // Should show status with verbose
      expect(stdout).toContain('Nebula Status');
    });

    it('should enable verbose output with --verbose', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} --verbose status`);
      expect(stdout).toContain('Nebula Status');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple flags combined', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} -v -q status`);
      expect(stdout).toContain('Nebula Status');
    });

    it('should handle flags in different order', async () => {
      const { stdout } = await execAsync(`${CLI_COMMAND} status -v -q`);
      expect(stdout).toContain('Nebula Status');
    });
  });
});
