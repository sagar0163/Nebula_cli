import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const ANALYTICS_DIR = path.join(os.homedir(), '.nebula-cli', 'team');
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, 'analytics.json');

export class TeamAnalytics {
    constructor(options = {}) {
        this.analyticsFile = options.analyticsFile || ANALYTICS_FILE;
        this.data = {
            usage: {},
            errors: {},
            efficiency: {
                timeSavedMs: 0,
                patternsUsed: 0
            }
        };
    }

    async load() {
        try {
            const fileData = await fs.readFile(this.analyticsFile, 'utf8');
            this.data = JSON.parse(fileData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Failed to load team analytics', error);
            }
        }
    }

    async save() {
        try {
            await fs.mkdir(path.dirname(this.analyticsFile), { recursive: true });
            await fs.writeFile(this.analyticsFile, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to save team analytics', error);
        }
    }

    async recordUsage(command) {
        await this.load();
        this.data.usage[command] = (this.data.usage[command] || 0) + 1;
        await this.save();
    }

    async recordError(errorType) {
        await this.load();
        this.data.errors[errorType] = (this.data.errors[errorType] || 0) + 1;
        await this.save();
    }

    async recordEfficiency(timeSavedMs) {
        await this.load();
        this.data.efficiency.timeSavedMs += timeSavedMs;
        this.data.efficiency.patternsUsed += 1;
        await this.save();
    }

    async getDashboardData() {
        await this.load();
        return this.data;
    }
}
