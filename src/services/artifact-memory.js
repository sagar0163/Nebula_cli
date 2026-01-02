import fs from 'fs';
import path from 'path';
import os from 'os';
import ollama from 'ollama';
import { ProjectID } from '../utils/project-id.js';
import chalk from 'chalk';

const MEMORY_DIR = path.join(os.homedir(), '.nebula-cli', 'memory');
const ARTIFACT_DB = path.join(MEMORY_DIR, 'artifacts.json');

class ArtifactMemory {
    constructor() {
        this.projectUUID = null;
        this.artifacts = {}; // { projectUUID: [ { path, content, embedding, timestamp } ] }
        this.chunkSize = 1000;
        this.maxFiles = 50;
        this.allowedExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.md', '.json', '.yaml', '.yml', '.sh', '.txt'];

        if (!fs.existsSync(MEMORY_DIR)) {
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
        }
    }

    async initialize(cwd) {
        this.projectUUID = await ProjectID.getOrCreateUID(cwd);
        await this.loadPersistent();
    }

    async indexProject(cwd) {
        if (!this.projectUUID) await this.initialize(cwd);

        // Check if already indexed recently (e.g. < 1 hour)
        // For now, fast re-index or diff check could be here.
        // We'll do a fresh scan but limit file count.

        const files = this.scanFiles(cwd);
        if (files.length === 0) return;

        console.log(chalk.gray(`\n📚 Indexing ${files.length} artifacts for RAG...`));

        this.artifacts[this.projectUUID] = []; // Reset for now (naive refresh)

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                if (content.length > 50000) continue; // Skip huge files

                // Chunking
                const chunks = this.chunkText(content);

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const embedding = await this.embed(chunk);
                    if (embedding) {
                        this.artifacts[this.projectUUID].push({
                            path: path.relative(cwd, file),
                            chunkIndex: i,
                            content: chunk,
                            embedding,
                            timestamp: Date.now()
                        });
                    }
                }
            } catch (e) {
                // Ignore read errors
            }
        }

        await this.savePersistent();
        console.log(chalk.gray(`📚 Indexed ${this.artifacts[this.projectUUID].length} chunks.`));
    }

    scanFiles(dir, depth = 0, collected = []) {
        if (depth > 4 || collected.length >= this.maxFiles) return collected;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    this.scanFiles(fullPath, depth + 1, collected);
                } else if (entry.isFile()) {
                    if (this.allowedExts.includes(path.extname(entry.name)) && collected.length < this.maxFiles) {
                        collected.push(fullPath);
                    }
                }
            }
        } catch (e) { }
        return collected;
    }

    chunkText(text) {
        const chunks = [];
        for (let i = 0; i < text.length; i += this.chunkSize) {
            chunks.push(text.slice(i, i + this.chunkSize));
        }
        return chunks;
    }

    async embed(text) {
        try {
            const response = await ollama.embeddings({
                model: 'nomic-embed-text',
                prompt: text.slice(0, 8192)
            });
            return response.embedding;
        } catch (e) {
            return this.deterministicEmbed(text); // Fallback
        }
    }

    deterministicEmbed(text) {
        // Simple hash-based embedding fallback
        const vec = new Array(10).fill(0);
        let hash = 0;
        for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i);
        for (let i = 0; i < 10; i++) vec[i] = (hash >> (i * 3)) & 0xFF;
        const mag = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
        return vec.map(x => x / (mag || 1));
    }

    async search(query, topK = 3) {
        if (!this.projectUUID || !this.artifacts[this.projectUUID]) return [];

        const queryEmbedding = await this.embed(query);
        const candidates = this.artifacts[this.projectUUID] || [];

        return candidates.map(c => ({
            ...c,
            similarity: this.cosineSimilarity(queryEmbedding, c.embedding)
        }))
            .filter(c => c.similarity > 0.75)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    cosineSimilarity(a, b) {
        const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] || 0), 0);
        const normA = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
        const normB = Math.sqrt(b.reduce((sum, x) => sum + x * x, 0));
        return dot / (normA * normB || 1);
    }

    async loadPersistent() {
        try {
            if (fs.existsSync(ARTIFACT_DB)) {
                this.artifacts = JSON.parse(fs.readFileSync(ARTIFACT_DB, 'utf8'));
            }
        } catch (e) {
            this.artifacts = {};
        }
    }

    async savePersistent() {
        fs.writeFileSync(ARTIFACT_DB, JSON.stringify(this.artifacts, null, 2));
    }
}

export default new ArtifactMemory();
