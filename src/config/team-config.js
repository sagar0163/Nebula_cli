import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const TEAM_CONFIG_DIR = path.join(os.homedir(), '.nebula-cli', 'team');
const TEAM_CONFIG_FILE = path.join(TEAM_CONFIG_DIR, 'config.json');

const TeamConfigSchema = z.object({
    teamId: z.string().optional(),
    teamName: z.string().optional(),
    ssoProvider: z.string().optional(),
    syncUrl: z.string().optional(),
    autoSync: z.boolean().default(true),
    members: z.array(z.string()).default([]),
});

export class TeamConfig {
    constructor(options = {}) {
        this.configFile = options.configFile || TEAM_CONFIG_FILE;
        this.configDir = path.dirname(this.configFile);
    }

    async load() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            const parsed = JSON.parse(data);
            return TeamConfigSchema.parse(parsed);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return this.getDefaults();
            }
            throw new Error(`Failed to load team config: ${error.message}`);
        }
    }

    async save(configData) {
        try {
            const validated = TeamConfigSchema.parse(configData);
            await fs.mkdir(this.configDir, { recursive: true });
            await fs.writeFile(this.configFile, JSON.stringify(validated, null, 2), 'utf8');
            return validated;
        } catch (error) {
            throw new Error(`Failed to save team config: ${error.message}`);
        }
    }

    getDefaults() {
        return TeamConfigSchema.parse({});
    }
}
