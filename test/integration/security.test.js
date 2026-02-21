import { describe, it, expect } from 'vitest';
import { isSafeCommand, getCommandWarning, autonomyMode } from '../../src/utils/safe-guard.js';
import { SemanticCache } from '../../src/utils/cache.js';

describe('Security Tests', () => {
  describe('Dangerous Command Blocking', () => {
    it('should block rm -rf /', () => {
      expect(isSafeCommand('rm -rf /')).toBe(false);
    });

    it('should block rm -rf .', () => {
      expect(isSafeCommand('rm -rf .')).toBe(false);
    });

    it('should block kubectl delete', () => {
      expect(isSafeCommand('kubectl delete pod nginx')).toBe(false);
    });

    it('should block docker rm', () => {
      expect(isSafeCommand('docker rm -f container')).toBe(false);
    });

    it('should block docker rmi', () => {
      expect(isSafeCommand('docker rmi image')).toBe(false);
    });

    it('should block helm uninstall', () => {
      expect(isSafeCommand('helm uninstall release')).toBe(false);
    });

    it('should block chmod 777 recursively', () => {
      expect(isSafeCommand('chmod -R 777 /some/path')).toBe(false);
    });

    it('should block git reset --hard', () => {
      expect(isSafeCommand('git reset --hard HEAD~1')).toBe(false);
    });

    it('should block git clean -fdx', () => {
      expect(isSafeCommand('git clean -fdx')).toBe(false);
    });

    it('should block fork bomb', () => {
      expect(isSafeCommand(':(){:|:&};:')).toBe(false);
    });

    it('should block dd command', () => {
      expect(isSafeCommand('dd if=/dev/zero of=/dev/sda')).toBe(false);
    });

    it('should block mkfs', () => {
      expect(isSafeCommand('mkfs /dev/sda1')).toBe(false);
    });
  });

  describe('Safe Commands Allowed', () => {
    it('should allow ls', () => {
      expect(isSafeCommand('ls')).toBe(true);
    });

    it('should allow ls -la', () => {
      expect(isSafeCommand('ls -la')).toBe(true);
    });

    it('should allow pwd', () => {
      expect(isSafeCommand('pwd')).toBe(true);
    });

    it('should allow cat file', () => {
      expect(isSafeCommand('cat README.md')).toBe(true);
    });

    it('should allow git status', () => {
      expect(isSafeCommand('git status')).toBe(true);
    });

    it('should allow git log', () => {
      expect(isSafeCommand('git log --oneline')).toBe(true);
    });

    it('should allow kubectl get', () => {
      expect(isSafeCommand('kubectl get pods')).toBe(true);
    });

    it('should allow kubectl describe', () => {
      expect(isSafeCommand('kubectl describe pod nginx')).toBe(true);
    });

    it('should allow docker ps', () => {
      expect(isSafeCommand('docker ps')).toBe(true);
    });

    it('should allow docker images', () => {
      expect(isSafeCommand('docker images')).toBe(true);
    });

    it('should allow helm list', () => {
      expect(isSafeCommand('helm list')).toBe(true);
    });

    it('should allow minikube status', () => {
      expect(isSafeCommand('minikube status')).toBe(true);
    });
  });

  describe('Command Warning Messages', () => {
    it('should return warning for dangerous commands', () => {
      const warning = getCommandWarning('rm -rf /');
      expect(warning).toContain('DANGER');
    });

    it('should return null for safe commands', () => {
      const warning = getCommandWarning('ls');
      expect(warning).toBeNull();
    });
  });

  describe('Autonomy Mode', () => {
    it('should return AUTO for safe read commands', () => {
      expect(autonomyMode('ls')).toBe('AUTO');
      expect(autonomyMode('kubectl get pods')).toBe('AUTO');
      expect(autonomyMode('docker ps')).toBe('AUTO');
    });

    it('should return BLOCKED for dangerous commands', () => {
      expect(autonomyMode('rm -rf /')).toBe('BLOCKED');
      expect(autonomyMode('kubectl delete pod nginx')).toBe('BLOCKED');
    });

    it('should return MANUAL for other commands', () => {
      expect(autonomyMode('npm install')).toBe('MANUAL');
      expect(autonomyMode('git commit -m "test"')).toBe('MANUAL');
    });
  });

  describe('API Key Security', () => {
    it('should store and retrieve fixes in cache', () => {
      const cache = new SemanticCache();
      const command = 'test command';
      const error = 'test error';
      const fix = 'fix with key ABC123';

      cache.set(command, error, fix);
      const cached = cache.get(command, error);

      expect(cached).toBe(fix);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should block SQL injection attempts', () => {
      expect(isSafeCommand("'; DROP TABLE users;--")).toBe(false);
      expect(isSafeCommand("SELECT * FROM users WHERE id=1; DELETE FROM users;")).toBe(false);
    });
  });

  describe('Command Injection Prevention', () => {
    it('should block command injection with semicolons', () => {
      expect(isSafeCommand('ls; rm -rf /')).toBe(false);
      expect(isSafeCommand('echo hello && cat /etc/passwd')).toBe(false);
    });

    it('should block command injection with pipes', () => {
      expect(isSafeCommand('ls | cat /etc/passwd')).toBe(false);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should block path traversal attempts', () => {
      expect(isSafeCommand('../../../etc/passwd')).toBe(false);
      expect(isSafeCommand('cat ../../../etc/shadow')).toBe(false);
    });
  });
});
