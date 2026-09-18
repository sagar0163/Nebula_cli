import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TeamAuth } from '../../src/services/team-auth.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('TeamAuth', () => {
    let tmpDir;
    let tokenFile;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nebula-team-auth-'));
        tokenFile = path.join(tmpDir, 'auth.json');
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('returns null if no token exists', async () => {
        const auth = new TeamAuth({ tokenFile });
        const token = await auth.getToken();
        expect(token).toBeNull();
    });

    it('saves and loads token', async () => {
        const auth = new TeamAuth({ tokenFile });
        await auth.saveToken('test-token-123');
        
        const token = await auth.getToken();
        expect(token).toBe('test-token-123');
    });

    it('clears token', async () => {
        const auth = new TeamAuth({ tokenFile });
        await auth.saveToken('test-token-123');
        await auth.clearToken();
        
        const token = await auth.getToken();
        expect(token).toBeNull();
    });
    
    it('throws when checking membership without token', async () => {
        const auth = new TeamAuth({ tokenFile });
        await expect(auth.getTeamMembership('team1')).rejects.toThrow('Not authenticated');
    });
});
