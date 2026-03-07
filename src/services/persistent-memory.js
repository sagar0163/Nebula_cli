// 2026 Persistent Memory with Vector Storage
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PersistentMemory {
    constructor(options = {}) {
        this.storageDir = options.storageDir || path.join(__dirname, '../../.nebula/memory');
        this.namespace = options.namespace || 'default';
        this.maxEntries = options.maxEntries || 1000;
        this.embeddingsEnabled = options.embeddings !== false;
        
        this.#ensureStorageDir();
    }

    #ensureStorageDir() {
        const dir = path.join(this.storageDir, this.namespace);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // Generate simple hash-based embedding (for without AI embeddings)
    #simpleHash(text) {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    // Store a memory
    async remember(key, value, metadata = {}) {
        const id = this.#simpleHash(key + Date.now());
        const memory = {
            id,
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : value,
            metadata: {
                ...metadata,
                created: Date.now(),
                namespace: this.namespace,
            },
            // Simple vector representation (hash-based for now)
            vector: this.#simpleHash(key + ' ' + JSON.stringify(value)),
        };

        const filePath = path.join(this.storageDir, this.namespace, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));

        // Maintain max entries
        await this.#pruneOldEntries();

        return memory;
    }

    // Recall a specific memory
    async recall(key) {
        const files = fs.readdirSync(path.join(this.storageDir, this.namespace));
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const content = fs.readFileSync(
                path.join(this.storageDir, this.namespace, file),
                'utf-8'
            );
            const memory = JSON.parse(content);
            
            if (memory.key === key) {
                return memory;
            }
        }
        
        return null;
    }

    // Search memories by similarity (simple keyword matching)
    async search(query, limit = 5) {
        const memories = await this.#getAllMemories();
        const queryLower = query.toLowerCase();
        
        // Score by relevance
        const scored = memories.map(memory => {
            let score = 0;
            const keyLower = memory.key.toLowerCase();
            const valueLower = memory.value.toLowerCase();
            
            // Exact match
            if (keyLower === queryLower) score += 100;
            // Key contains query
            if (keyLower.includes(queryLower)) score += 50;
            // Value contains query
            if (valueLower.includes(queryLower)) score += 30;
            // Metadata match
            if (memory.metadata?.tags?.some(t => t.toLowerCase().includes(queryLower))) {
                score += 20;
            }
            
            return { ...memory, score };
        });
        
        // Sort by score and return top results
        return scored
            .filter(m => m.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // Get all memories
    async #getAllMemories() {
        const dir = path.join(this.storageDir, this.namespace);
        if (!fs.existsSync(dir)) return [];
        
        const files = fs.readdirSync(dir);
        const memories = [];
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            try {
                const content = fs.readFileSync(path.join(dir, file), 'utf-8');
                memories.push(JSON.parse(content));
            } catch (e) {
                // Skip corrupted files
            }
        }
        
        return memories.sort((a, b) => 
            b.metadata.created - a.metadata.created
        );
    }

    // Prune old entries
    async #pruneOldEntries() {
        const memories = await this.#getAllMemories();
        
        if (memories.length > this.maxEntries) {
            // Delete oldest entries
            const toDelete = memories.slice(this.maxEntries);
            for (const mem of toDelete) {
                const filePath = path.join(
                    this.storageDir, 
                    this.namespace, 
                    `${mem.id}.json`
                );
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
    }

    // Learn from interaction (auto-save important context)
    async learn(context, outcome, tags = []) {
        return this.remember(
            `interaction_${Date.now()}`,
            { context, outcome },
            { tags: ['interaction', ...tags], important: true }
        );
    }

    // Get conversation context
    async getContext(limit = 10) {
        const memories = await this.#getAllMemories();
        return memories
            .filter(m => m.metadata?.important)
            .slice(-limit);
    }

    // Clear namespace
    async clear() {
        const dir = path.join(this.storageDir, this.namespace);
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true });
            this.#ensureStorageDir();
        }
    }

    // Export memories
    async export() {
        const memories = await this.#getAllMemories();
        return {
            namespace: this.namespace,
            count: memories.length,
            memories,
            exported: Date.now(),
        };
    }

    // Import memories
    async import(data) {
        if (data.namespace !== this.namespace) {
            throw new Error('Namespace mismatch');
        }
        
        for (const memory of data.memories) {
            const filePath = path.join(
                this.storageDir, 
                this.namespace, 
                `${memory.id}.json`
            );
            fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
        }
        
        return { imported: data.memories.length };
    }
}

// Project-specific memory (isolated per project)
export class ProjectMemory extends PersistentMemory {
    constructor(projectPath) {
        const projectName = path.basename(projectPath);
        super({
            namespace: `project_${projectName}`,
            storageDir: path.join(projectPath, '.nebula/memory'),
        });
        this.projectPath = projectPath;
    }

    // Remember file changes
    async rememberFile(filePath, change, content) {
        return this.remember(
            `file_${filePath}`,
            { change, content: content?.substring(0, 1000) },
            { tags: ['file', 'change'], filePath }
        );
    }

    // Get recent file changes
    async getRecentFiles(limit = 10) {
        const memories = await this.search('file_', limit);
        return memories.map(m => ({
            file: m.key.replace('file_', ''),
            change: m.value.change,
            time: m.metadata.created,
        }));
    }
}

export default PersistentMemory;
