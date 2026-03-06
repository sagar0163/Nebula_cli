import { describe, it, expect, beforeEach } from 'vitest';
import { isSafeCommand, CRITICAL_COMMANDS } from '../src/utils/safe-guard.js';

describe('Safe Guard', () => {
    describe('isSafeCommand', () => {
        it('should allow safe read commands', () => {
            expect(isSafeCommand('ls')).toBe(true);
            expect(isSafeCommand('ls -la')).toBe(true);
            expect(isSafeCommand('cat README.md')).toBe(true);
            expect(isSafeCommand('pwd')).toBe(true);
        });

        it('should block dangerous commands', () => {
            expect(isSafeCommand('rm -rf /')).toBe(false);
            expect(isSafeCommand('dd if=/dev/zero of=/dev/sda')).toBe(false);
            expect(isSafeCommand('kubectl delete ns kube-system')).toBe(false);
            expect(isSafeCommand('docker rm -f $(docker ps -aq)')).toBe(false);
        });

        it('should allow safe pipe commands', () => {
            expect(isSafeCommand('cat file.txt | grep hello')).toBe(true);
            expect(isSafeCommand('ls | head -n 5')).toBe(true);
            expect(isSafeCommand('cat log.txt | tail -20')).toBe(true);
            expect(isSafeCommand('cat data.json | wc -l')).toBe(true);
        });

        it('should block SQL injection patterns', () => {
            expect(isSafeCommand('mysql -e "drop table users"')).toBe(false);
            expect(isSafeCommand('psql -c "delete from users"')).toBe(false);
        });

        it('should block path traversal', () => {
            expect(isSafeCommand('cat ../../../etc/passwd')).toBe(false);
            expect(isSafeCommand('cd ../../../ && ls')).toBe(false);
        });
    });
});
