import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TeamAnalytics } from '../../src/services/team-analytics.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('TeamAnalytics', () => {
    let tmpDir;
    let analyticsFile;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nebula-team-analytics-'));
        analyticsFile = path.join(tmpDir, 'analytics.json');
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('initializes with empty data', async () => {
        const analytics = new TeamAnalytics({ analyticsFile });
        const data = await analytics.getDashboardData();
        expect(data.usage).toEqual({});
        expect(data.errors).toEqual({});
        expect(data.efficiency.timeSavedMs).toBe(0);
    });

    it('records usage', async () => {
        const analytics = new TeamAnalytics({ analyticsFile });
        await analytics.recordUsage('deploy');
        await analytics.recordUsage('deploy');
        
        const data = await analytics.getDashboardData();
        expect(data.usage.deploy).toBe(2);
    });

    it('records error', async () => {
        const analytics = new TeamAnalytics({ analyticsFile });
        await analytics.recordError('port_conflict');
        
        const data = await analytics.getDashboardData();
        expect(data.errors.port_conflict).toBe(1);
    });

    it('records efficiency', async () => {
        const analytics = new TeamAnalytics({ analyticsFile });
        await analytics.recordEfficiency(5000);
        
        const data = await analytics.getDashboardData();
        expect(data.efficiency.timeSavedMs).toBe(5000);
        expect(data.efficiency.patternsUsed).toBe(1);
    });
});
