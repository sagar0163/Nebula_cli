import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TeamConfig } from '../../src/config/team-config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('TeamConfig', () => {
    let tmpDir;
    let configFile;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nebula-team-config-'));
        configFile = path.join(tmpDir, 'config.json');
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('returns defaults if config does not exist', async () => {
        const config = new TeamConfig({ configFile });
        const data = await config.load();
        expect(data).toBeDefined();
        expect(data.autoSync).toBe(true);
        expect(data.members).toEqual([]);
    });

    it('saves and loads config', async () => {
        const config = new TeamConfig({ configFile });
        await config.save({
            teamId: 'team-123',
            autoSync: false,
            members: ['user1']
        });
        
        const data = await config.load();
        expect(data.teamId).toBe('team-123');
        expect(data.autoSync).toBe(false);
        expect(data.members).toEqual(['user1']);
    });
});
