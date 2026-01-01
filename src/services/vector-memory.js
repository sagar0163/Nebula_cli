import fs from 'fs';
import path from 'path';
import os from 'os';
import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from 'chalk';

export class VectorMemory {
    constructor() {
        this.dbPath = path.join(os.homedir(), '.nebula-cli', 'vector.db');
        this.#ensureDir();

        // Initialize Gemini for embeddings
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
        }
    }

    /**
     * Generates an embedding for the given text using Gemini.
     * @param {string} text 
     * @returns {Promise<number[]|null>}
     */
    async embed(text) {
        if (!this.model) return null;
        try {
            const result = await this.model.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            // Log warning but don't crash - allows fallback to standard AI
            console.warn(chalk.yellow(`\n⚠️  Vector Memory unavailable: ${error.message}`));
            return null;
        }
    }

    /**
     * Stores a fix with its vector embedding.
     * @param {string} command 
     * @param {string} error 
     * @param {string} fix 
     * @param {object} context 
     */
    async store(command, error, fix, context = {}) {
        const textToEmbed = `${command} ${error}`;
        const embedding = await this.embed(textToEmbed);

        if (!embedding) return false;

        const entry = {
            id: Date.now(),
            command,
            error,
            fix,
            context,
            embedding,
            timestamp: new Date().toISOString()
        };

        const data = this.#load();
        data.push(entry);
        this.#save(data);
        return true;
    }

    /**
     * Finds similar cached fixes using Cosine Similarity.
     * @param {string} command 
     * @param {string} error 
     * @param {number} threshold 
     * @returns {Promise<Array>}
     */
    async findSimilar(command, error, threshold = 0.85) {
        const textToEmbed = `${command} ${error}`;
        const queryEmbedding = await this.embed(textToEmbed);

        if (!queryEmbedding) return [];

        const data = this.#load();
        const matches = data.map(entry => ({
            ...entry,
            similarity: this.#cosineSimilarity(queryEmbedding, entry.embedding)
        }))
            .filter(item => item.similarity > threshold)
            .sort((a, b) => b.similarity - a.similarity);

        return matches;
    }

    #cosineSimilarity(a, b) {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        if (magA === 0 || magB === 0) return 0;
        return dot / (magA * magB);
    }

    #load() {
        try {
            if (!fs.existsSync(this.dbPath)) return [];
            return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        } catch {
            return [];
        }
    }

    #save(data) {
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    }

    #ensureDir() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
