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

    describe('canEditPattern (admin permission control)', () => {
        it('allows any member when no permissions configured', async () => {
            const config = new TeamConfig({ configFile });
            const data = await config.load();
            expect(config.canEditPattern(data, 'alice', 'deploy')).toBe(true);
            expect(config.canEditPattern(data, 'alice', 'custom')).toBe(true);
        });

        it("restricts category edits to admins when set to 'admin'", async () => {
            const config = new TeamConfig({ configFile });
            await config.save({
                teamId: 'team-123',
                members: ['alice', 'bob'],
                admins: ['bob'],
                patternPermissions: { deploy: 'admin' }
            });
            const data = await config.load();

            expect(config.canEditPattern(data, 'bob', 'deploy')).toBe(true);
            expect(config.canEditPattern(data, 'alice', 'deploy')).toBe(false);
            // 'bob' is admin but 'alice' still edits other (unrestricted) categories
            expect(config.canEditPattern(data, 'alice', 'custom')).toBe(true);
        });

        it('restricts category edits to an explicit allow-list', async () => {
            const config = new TeamConfig({ configFile });
            await config.save({
                teamId: 'team-123',
                members: ['alice', 'bob'],
                patternPermissions: { review: ['alice'] }
            });
            const data = await config.load();

            expect(config.canEditPattern(data, 'alice', 'review')).toBe(true);
            expect(config.canEditPattern(data, 'bob', 'review')).toBe(false);
        });

        it('denies anonymous edits', async () => {
            const config = new TeamConfig({ configFile });
            const data = await config.load();
            expect(config.canEditPattern(data, undefined, 'deploy')).toBe(false);
        });
    });
});
