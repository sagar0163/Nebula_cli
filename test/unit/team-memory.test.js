import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TeamMemory } from '../../src/services/team-memory.js';

describe('TeamMemory', () => {
    let tempDir;
    let teamMemory;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-team-test-'));
        teamMemory = new TeamMemory({
            storageDir: tempDir,
            nodeId: 'test-node-1'
        });
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('initialize', () => {
        it('should set the teamId', async () => {
            await teamMemory.initialize('team-alpha');
            expect(teamMemory.teamId).toBe('team-alpha');
        });
    });

    describe('store', () => {
        it('should throw if not initialized', async () => {
            await expect(teamMemory.store({ name: 'test', commands: ['ls'] }))
                .rejects.toThrow('TeamMemory not initialized');
        });

        it('should throw if missing required fields', async () => {
            await teamMemory.initialize('team-alpha');
            await expect(teamMemory.store({ name: 'test' }))
                .rejects.toThrow('must have name and commands');
            await expect(teamMemory.store({ commands: ['ls'] }))
                .rejects.toThrow('must have name and commands');
        });

        it('should store a pattern and persist it', async () => {
            await teamMemory.initialize('team-alpha');
            const pattern = await teamMemory.store({
                name: 'docker-port-conflict',
                category: 'debug',
                description: 'Fix port conflicts in Docker',
                commands: ['docker stop $(docker ps -q)', 'docker-compose up -d'],
                tags: ['docker', 'port', 'networking'],
                author: 'alice'
            });

            expect(pattern.id).toBe('team-alpha:docker-port-conflict');
            expect(pattern.teamId).toBe('team-alpha');
            expect(pattern.commands).toEqual(['docker stop $(docker ps -q)', 'docker-compose up -d']);
            expect(pattern.vectorClock['test-node-1']).toBe(1);
            expect(pattern.usageCount).toBe(0);

            // Verify persistence
            const reloaded = new TeamMemory({ storageDir: tempDir, nodeId: 'test-node-1' });
            await reloaded.initialize('team-alpha');
            const found = reloaded.get('team-alpha:docker-port-conflict');
            expect(found).not.toBeNull();
            expect(found.commands).toEqual(pattern.commands);
        });

        it('should convert single command to array', async () => {
            await teamMemory.initialize('team-alpha');
            const pattern = await teamMemory.store({
                name: 'quick-fix',
                commands: 'npm install'
            });
            expect(pattern.commands).toEqual(['npm install']);
        });

        it('should increment vector clock on update', async () => {
            await teamMemory.initialize('team-alpha');
            await teamMemory.store({
                name: 'test-pattern',
                commands: ['cmd1']
            });
            const updated = await teamMemory.store({
                name: 'test-pattern',
                commands: ['cmd1', 'cmd2']
            });
            expect(updated.vectorClock['test-node-1']).toBe(2);
        });
    });

    describe('find', () => {
        beforeEach(async () => {
            await teamMemory.initialize('team-alpha');
            await teamMemory.store({
                name: 'docker-fix',
                category: 'debug',
                commands: ['docker-compose down'],
                tags: ['docker', 'cleanup']
            });
            await teamMemory.store({
                name: 'deploy-staging',
                category: 'deploy',
                commands: ['git push origin staging'],
                tags: ['deploy', 'staging']
            });
            await teamMemory.store({
                name: 'code-review',
                category: 'review',
                commands: ['npm run lint', 'npm test'],
                tags: ['review', 'lint']
            });
        });

        it('should filter by category', () => {
            const results = teamMemory.find({ category: 'debug' });
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('docker-fix');
        });

        it('should filter by tags', () => {
            const results = teamMemory.find({ tags: ['docker'] });
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('docker-fix');
        });

        it('should search by text', () => {
            const results = teamMemory.find({ search: 'docker' });
            expect(results.length).toBeGreaterThanOrEqual(1);
        });

        it('should respect limit', () => {
            const results = teamMemory.find({ limit: 2 });
            expect(results).toHaveLength(2);
        });

        it('should return all when no query', () => {
            const results = teamMemory.find();
            expect(results).toHaveLength(3);
        });
    });

    describe('get', () => {
        it('should return null for missing pattern', () => {
            expect(teamMemory.get('nonexistent')).toBeNull();
        });
    });

    describe('recordUsage', () => {
        it('should increment usage count and effectiveness', async () => {
            await teamMemory.initialize('team-alpha');
            const pattern = await teamMemory.store({
                name: 'test',
                commands: ['ls']
            });

            teamMemory.recordUsage(pattern.id, true);
            teamMemory.recordUsage(pattern.id, true);
            teamMemory.recordUsage(pattern.id, false);

            const updated = teamMemory.get(pattern.id);
            expect(updated.usageCount).toBe(3);
            expect(updated.effectivenessScore).toBe(2);
        });

        it('should handle non-existent pattern gracefully', () => {
            teamMemory.recordUsage('nonexistent'); // should not throw
        });
    });

    describe('delete', () => {
        it('should remove a pattern', async () => {
            await teamMemory.initialize('team-alpha');
            const pattern = await teamMemory.store({
                name: 'to-delete',
                commands: ['rm -rf /']
            });

            expect(teamMemory.delete(pattern.id)).toBe(true);
            expect(teamMemory.get(pattern.id)).toBeNull();
        });

        it('should return false for non-existent pattern', () => {
            expect(teamMemory.delete('nonexistent')).toBe(false);
        });
    });

    describe('listAll', () => {
        it('should return all patterns', async () => {
            await teamMemory.initialize('team-alpha');
            await teamMemory.store({ name: 'a', commands: ['a'] });
            await teamMemory.store({ name: 'b', commands: ['b'] });

            expect(teamMemory.listAll()).toHaveLength(2);
        });
    });

    describe('export/import (CRDT merge)', () => {
        it('should export patterns as portable JSON', async () => {
            await teamMemory.initialize('team-alpha');
            await teamMemory.store({ name: 'test', commands: ['ls'] });

            const exported = teamMemory.export();
            expect(exported.teamId).toBe('team-alpha');
            expect(exported.patterns).toHaveLength(1);
        });

        it('should import new patterns', async () => {
            await teamMemory.initialize('team-alpha');
            const data = {
                teamId: 'team-alpha',
                nodeId: 'remote-node',
                patterns: [{
                    id: 'team-alpha:remote-pattern',
                    teamId: 'team-alpha',
                    name: 'remote-pattern',
                    category: 'debug',
                    description: 'From remote',
                    commands: ['echo hello'],
                    tags: [],
                    author: 'bob',
                    vectorClock: { 'remote-node': 1 },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    usageCount: 5,
                    effectivenessScore: 3
                }]
            };

            const result = teamMemory.import(data);
            expect(result.merged).toBe(1);
            expect(teamMemory.get('team-alpha:remote-pattern')).not.toBeNull();
        });

        it('should merge concurrent edits via CRDT', async () => {
            await teamMemory.initialize('team-alpha');

            // Local has v2 from node-1, remote has v2 from node-2 (concurrent)
            const local = await teamMemory.store({
                name: 'shared-pattern',
                commands: ['cmd-a']
            });
            // Bump local clock manually for concurrency simulation
            local.vectorClock = { 'test-node-1': 2, 'remote-node': 0 };

            const remoteData = {
                teamId: 'team-alpha',
                nodeId: 'remote-node',
                patterns: [{
                    ...local,
                    vectorClock: { 'test-node-1': 0, 'remote-node': 2 },
                    commands: ['cmd-b'],
                    updatedAt: new Date(Date.now() + 1000).toISOString()
                }]
            };

            const result = teamMemory.import(remoteData);
            // Should be a conflict merge
            expect(result.conflicts).toBe(1);

            const merged = teamMemory.get(local.id);
            // Commands should be merged (union)
            expect(merged.commands).toContain('cmd-a');
            expect(merged.commands).toContain('cmd-b');
        });

        it('should accept remote when it dominates', async () => {
            await teamMemory.initialize('team-alpha');
            await teamMemory.store({ name: 'test', commands: ['old'] });

            const remoteData = {
                teamId: 'team-alpha',
                patterns: [{
                    id: 'team-alpha:test',
                    teamId: 'team-alpha',
                    name: 'test',
                    category: 'debug',
                    commands: ['new-cmd'],
                    vectorClock: { 'test-node-1': 1, 'remote-node': 3 },
                    updatedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    usageCount: 10,
                    effectivenessScore: 5
                }]
            };

            const result = teamMemory.import(remoteData);
            expect(result.merged).toBe(1);
            const merged = teamMemory.get('team-alpha:test');
            expect(merged.commands).toEqual(['new-cmd']);
        });

        it('should reject invalid import data', () => {
            expect(() => teamMemory.import(null)).toThrow('Invalid import data');
            expect(() => teamMemory.import({})).toThrow('Invalid import data');
            expect(() => teamMemory.import({ patterns: 'not-array' })).toThrow('Invalid import data');
        });
    });
});
