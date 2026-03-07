// 2026 Persistent Memory - Simplified for CLI context
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PersistentMemory {
    constructor(options = {}) {
        this.storageDir = options.storageDir || path.join(__dirname, '../../.nebula/memory');
        this.namespace = options.namespace || 'default';
        this.maxEntries = options.maxEntries || 100;
        
        this.#ensureDir();
    }

    #ensureDir() {
        const dir = path.join(this.storageDir, this.namespace);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async remember(key, value, metadata = {}) {
        const id = crypto.createHash('sha256').update(key + Date.now()).digest('hex').slice(0, 16);
        
        const memory = {
            id, key,
            value: typeof value === 'object' ? JSON.stringify(value) : value,
            metadata: { ...metadata, created: Date.now() },
        };

        fs.writeFileSync(
            path.join(this.storageDir, this.namespace, `${id}.json`),
            JSON.stringify(memory)
        );

        await this.#prune();
        return memory;
    }

    async recall(key) {
        const dir = path.join(this.storageDir, this.namespace);
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
            if (content.key === key) return content;
        }
        return null;
    }

    async search(query, limit = 5) {
        const dir = path.join(this.storageDir, this.namespace);
        if (!fs.existsSync(dir)) return [];
        
        const files = fs.readdirSync(dir);
        const results = [];
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
            const text = (content.key + ' ' + content.value).toLowerCase();
            if (text.includes(query.toLowerCase())) {
                results.push({ ...content, score: text.split(query.toLowerCase()).length });
            }
        }
        
        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    async getContext(limit = 10) {
        const dir = path.join(this.storageDir, this.namespace);
        if (!fs.existsSync(dir)) return [];
        
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const memories = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
        
        return memories
            .sort((a, b) => b.metadata.created - a.metadata.created)
            .slice(-limit);
    }

    async #prune() {
        const dir = path.join(this.storageDir, this.namespace);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        
        if (files.length > this.maxEntries) {
            const memories = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
            memories.sort((a, b) => a.metadata.created - b.metadata.created);
            
            for (const mem of memories.slice(0, files.length - this.maxEntries)) {
                fs.unlinkSync(path.join(dir, `${mem.id}.json`));
            }
        }
    }
}

export default PersistentMemory;
