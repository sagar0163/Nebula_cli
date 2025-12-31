import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export class SemanticCache {
    constructor() {
        this.cacheDir = path.join(os.homedir(), '.nebula-cli');
        this.cacheFile = path.join(this.cacheDir, 'cache.json');
        this.#ensureCacheExists();
    }

    /**
     * Retrieves a cached fix if available.
     * @param {string} command - The failed command.
     * @param {string} error - The error message.
     * @returns {string|null} - The cached fix or null.
     */
    get(command, error) {
        const key = this.#generateKey(command, error);
        const data = this.#readCache();
        return data[key] || null;
    }

    /**
     * Stores a successful fix.
     * @param {string} command - The failed command.
     * @param {string} error - The error message.
     * @param {string} fix - The working fix.
     */
    set(command, error, fix) {
        const key = this.#generateKey(command, error);
        const data = this.#readCache();
        data[key] = fix;
        this.#writeCache(data);
    }

    #generateKey(command, error) {
        // Basic normalization: remove timestamps or variable parts if needed (future improvement)
        // For now, hash the combined string to creating a unique key
        const content = `${command.trim()}|${error.trim()}`;
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    #ensureCacheExists() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        if (!fs.existsSync(this.cacheFile)) {
            fs.writeFileSync(this.cacheFile, JSON.stringify({}));
        }
    }

    #readCache() {
        try {
            const start = Date.now();
            const content = fs.readFileSync(this.cacheFile, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            return {};
        }
    }

    #writeCache(data) {
        fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    }
}
