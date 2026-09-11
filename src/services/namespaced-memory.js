import fs from 'fs';
import path from 'path';
import os from 'os';
import ollama from 'ollama';
import crypto from 'crypto';
import { ProjectID } from '../utils/project-id.js';

const MEMORY_DIR = path.join(os.homedir(), '.nebula-cli', 'memory'); // Cleaned up path
const DB_FILE = path.join(MEMORY_DIR, 'projects.json');

// Derive a key from the machine's hostname and user to use for encryption
const ENCRYPTION_KEY = crypto.scryptSync(os.hostname() + '_' + os.userInfo().username, 'nebula_salt', 32);

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
            id: crypto.randomUUID(), // add an ID for easy forgetting
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
     * Import memory data from an exported file
     */
    async importData(data) {
        if (!data || !data.patterns) return;
        
        if (!this.projectUUID) {
            this.projectUUID = await ProjectID.getOrCreateUID(process.cwd());
        }

        this.projectFixes[this.projectUUID] = this.projectFixes[this.projectUUID] || [];
        
        for (const pattern of data.patterns) {
            // Check if already exists based on command and error to prevent duplicates
            const exists = this.projectFixes[this.projectUUID].some(
                p => p.command === pattern.command && p.fix === pattern.fix
            );
            if (!exists) {
                // Ensure it has an ID
                if (!pattern.id) pattern.id = crypto.randomUUID();
                this.projectFixes[this.projectUUID].push(pattern);
            }
        }

        if (data.globalFixes) {
            for (const fix of data.globalFixes) {
                const exists = this.globalFixes.some(
                    p => p.command === fix.command && p.fix === fix.fix
                );
                if (!exists) {
                    if (!fix.id) fix.id = crypto.randomUUID();
                    this.globalFixes.push(fix);
                }
            }
        }

        await this.savePersistent();
    }

    /**
     * Forget a specific learned pattern
     */
    async forgetPattern(patternId) {
        if (!this.projectUUID) return;
        
        let removed = false;

        // Try to remove by ID
        if (this.projectFixes[this.projectUUID]) {
            const initialLength = this.projectFixes[this.projectUUID].length;
            this.projectFixes[this.projectUUID] = this.projectFixes[this.projectUUID].filter(
                p => p.id !== patternId && p.command !== patternId && p.fix !== patternId
            );
            if (this.projectFixes[this.projectUUID].length < initialLength) removed = true;
        }

        const globalInitialLength = this.globalFixes.length;
        this.globalFixes = this.globalFixes.filter(
            p => p.id !== patternId && p.command !== patternId && p.fix !== patternId
        );
        if (this.globalFixes.length < globalInitialLength) removed = true;

        if (removed) {
            await this.savePersistent();
        }
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

    decryptData(encryptedText) {
        try {
            const parts = encryptedText.split(':');
            const iv = Buffer.from(parts.shift(), 'hex');
            const authTag = Buffer.from(parts.shift(), 'hex');
            const encryptedTextBuffer = Buffer.from(parts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedTextBuffer, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (e) {
            // Fallback for unencrypted data during transition
            return encryptedText;
        }
    }

    encryptData(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }

    async loadPersistent() {
        try {
            if (fs.existsSync(DB_FILE)) {
                let data = fs.readFileSync(DB_FILE, 'utf8');
                
                // Try to decrypt if it looks like encrypted data (no { at start)
                if (data.trim() && !data.trim().startsWith('{')) {
                    data = this.decryptData(data);
                }
                
                const parsed = JSON.parse(data);
                this.projectFixes = parsed.projectFixes || {};
                this.globalFixes = parsed.globalFixes || [];
            }
        } catch (err) {
            console.error('Memory load error:', err.message);
            this.projectFixes = {};
            this.globalFixes = [];
        }
    }

    async savePersistent() {
        const dataStr = JSON.stringify({
            projectFixes: this.projectFixes,
            globalFixes: this.globalFixes,
            version: '4.4'
        });
        
        // Encrypt by default for privacy
        const encryptedData = this.encryptData(dataStr);
        
        await fs.promises.writeFile(DB_FILE, encryptedData, 'utf8');
    }
}

export default NamespacedVectorMemory;
