import { describe, it, expect } from 'vitest';
import { isSafeCommand } from '../../src/utils/safe-guard.js';

describe('safe-guard', () => {
  describe('isSafeCommand', () => {
    it('should block dangerous delete commands', () => {
      expect(isSafeCommand('rm -rf /')).toBe(false);
      expect(isSafeCommand('rm -rf .')).toBe(false);
    });

    it('should block destructive kubectl commands', () => {
      expect(isSafeCommand('kubectl delete pod nginx')).toBe(false);
      expect(isSafeCommand('kubectl delete namespace default')).toBe(false);
    });

    it('should block destructive docker commands', () => {
      expect(isSafeCommand('docker rm -f container')).toBe(false);
      expect(isSafeCommand('docker rmi image')).toBe(false);
      expect(isSafeCommand('docker kill container')).toBe(false);
    });

    it('should block helm destructive commands', () => {
      expect(isSafeCommand('helm uninstall my-release')).toBe(false);
      expect(isSafeCommand('helm delete my-release')).toBe(false);
    });

    it('should block chmod 777 commands', () => {
      expect(isSafeCommand('chmod -R 777 /some/path')).toBe(false);
    });

    it('should block git dangerous commands', () => {
      expect(isSafeCommand('git reset --hard HEAD~1')).toBe(false);
      expect(isSafeCommand('git clean -fdx')).toBe(false);
    });

    it('should allow safe read commands', () => {
      expect(isSafeCommand('ls')).toBe(true);
      expect(isSafeCommand('ls -la')).toBe(true);
      expect(isSafeCommand('pwd')).toBe(true);
    });

    it('should allow safe kubectl get commands', () => {
      expect(isSafeCommand('kubectl get pods')).toBe(true);
      expect(isSafeCommand('kubectl get ns')).toBe(true);
      expect(isSafeCommand('kubectl get deployments')).toBe(true);
    });

    it('should allow safe docker commands', () => {
      expect(isSafeCommand('docker ps')).toBe(true);
      expect(isSafeCommand('docker images')).toBe(true);
    });

    it('should block commands with dangerous expansions', () => {
      expect(isSafeCommand('$(malicious)')).toBe(false);
    });
  });
});
