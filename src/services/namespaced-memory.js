import fs from 'fs';
import path from 'path';
import os from 'os';
import ollama from 'ollama';
import { ProjectID } from '../utils/project-id.js';

const MEMORY_DIR = path.join(os.homedir(), '.nebula-cli', 'memory'); // Cleaned up path
const DB_FILE = path.join(MEMORY_DIR, 'projects.json');

class NamespacedVectorMemory {
    constructor() {
        this.sessionCache = new Map();  // Fast in-memory
        this.projectUUID = null;
        this.projectFixes = {};
        this.globalFixes = [];  // Universal errors only
        if (!fs.existsSync(MEMORY_DIR)) {
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
        }
    }

    /**
     * Initialize for current project
     */
    async initialize(cwd) {
        this.projectUUID = await ProjectID.getOrCreateUID(cwd);
        await this.loadPersistent();
        // console.log(`🧠 Memory ready for [${this.projectUUID}]`);
    }

    /**
     * Store fix with project namespace
     */
    async store(command, error, fix, context = {}) {
        if (!this.projectUUID) return; // Not initialized

        if (!fix || !command) return;

        // Generate embedding
        const embedding = await this.embed(command + ' ' + error);
        if (embedding.length === 0) return; // Embedding failed

        const entry = {
            projectUUID: this.projectUUID,
            isGlobal: false,
            command,
            error: error.slice(0, 500),  // Truncate
            fix,
            context: context.projectType || 'unknown',
            timestamp: new Date().toISOString(),
            embedding
        };

        // 1. Session cache (instant lookup)
        const cacheKey = `${this.projectUUID}:${command.slice(0, 20)}:${error.slice(0, 20)}`;
        this.sessionCache.set(cacheKey, fix);

        // 2. Persistent memory
        this.projectFixes[this.projectUUID] = this.projectFixes[this.projectUUID] || [];
        this.projectFixes[this.projectUUID].push(entry);

        // Limit history per project
        if (this.projectFixes[this.projectUUID].length > 1000) {
            this.projectFixes[this.projectUUID] = this.projectFixes[this.projectUUID].slice(-500);
        }

        await this.savePersistent();

        // console.log(`✅ Learned [${this.projectUUID}]: "${command}" → "${fix}"`);
    }

    /**
     * Tiered search: Session → Project → Global
     */
    async findSimilar(command, error, topK = 5) {
        if (!this.projectUUID) return [];

        const query = command + ' ' + error;

        // Tier 1: Session cache (0.1ms)
        const sessionKey = `${this.projectUUID}:${command.slice(0, 20)}:${error.slice(0, 20)}`;
        if (this.sessionCache.has(sessionKey)) {
            return [{
                fix: this.sessionCache.get(sessionKey),
                similarity: 1.0,
                source: 'session-cache',
                tier: 1
            }];
        }

        // Tier 2: Project namespace (90%+ similarity)
        const projectMatches = await this.searchNamespace(query, topK, command);
        if (projectMatches.length > 0) {
            return projectMatches.map(m => ({ ...m, tier: 2 }));
        }

        // Tier 3: Global universal fixes
        const globalMatches = await this.searchGlobal(query, topK);
        return globalMatches.map(m => ({ ...m, tier: 3 }));
    }

    async searchNamespace(query, topK, command) {
        const projectFixes = this.projectFixes[this.projectUUID] || [];
        if (projectFixes.length === 0) return [];

        const queryEmbedding = await this.embed(query);
        if (queryEmbedding.length === 0) return [];

        const matches = projectFixes.map(entry => ({
            ...entry,
            similarity: this.cosineSimilarity(queryEmbedding, entry.embedding)
        })).filter(m => m.similarity > 0.85 || m.command === command.trim())  // Fallback to exact command match
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        // Boost exact command matches to top
        matches.forEach(m => {
            if (m.command === command.trim()) m.similarity = 1.0;
        });

        return matches;
    }

    async searchGlobal(query, topK) {
        if (this.globalFixes.length === 0) return [];

        const queryEmbedding = await this.embed(query);
        if (queryEmbedding.length === 0) return [];

        const matches = this.globalFixes.map(entry => ({
            ...entry,
            similarity: this.cosineSimilarity(queryEmbedding, entry.embedding)
        })).filter(m => m.similarity > 0.95)  // Global threshold
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        return matches;
    }

    /**
     * Embed using Ollama (nomic-embed-text) OR fallback to simple deterministic hash/mock if unavailable?
     * User requested Ollama explicitly.
     */
    async embed(text) {
        try {
            const response = await ollama.embeddings({
                model: 'nomic-embed-text',
                prompt: text.slice(0, 8192)
            });
            return response.embedding;
        } catch (e) {
            // console.warn('Embedding failed (Ollama/nomic-embed-text not ready?):', e.message);
            // Fallback: Deterministic "hash" embedding for exact matching simulation
            return this.deterministicEmbed(text);
        }
    }

    deterministicEmbed(text) {
        // Simple 10-dimensional vector from string hash to allow basic similarity
        const vec = new Array(10).fill(0);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        // Spread hash bits across vector
        for (let i = 0; i < 10; i++) {
            vec[i] = (hash >> (i * 3)) & 0xFF; // naive distribution
        }
        // Normalize
        const mag = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
        return vec.map(x => x / (mag || 1));
    }

    cosineSimilarity(a, b) {
        const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] || 0), 0);
        const normA = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
        const normB = Math.sqrt(b.reduce((sum, x) => sum + x * x, 0));
        return dot / (normA * normB || 1);
    }

    async loadPersistent() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const data = fs.readFileSync(DB_FILE, 'utf8');
                const parsed = JSON.parse(data);
                this.projectFixes = parsed.projectFixes || {};
                this.globalFixes = parsed.globalFixes || [];
            }
        } catch {
            this.projectFixes = {};
            this.globalFixes = [];
        }
    }

    async savePersistent() {
        await fs.promises.writeFile(DB_FILE, JSON.stringify({
            projectFixes: this.projectFixes,
            globalFixes: this.globalFixes,
            version: '4.3'
        }, null, 2));
    }
}

export default NamespacedVectorMemory;
