import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';
import Groq from 'groq-sdk';
import chalk from 'chalk';

export class AIService {
    constructor() {
        // 1. Initialize Groq (Primary)
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        // 2. Initialize Gemini (Backup)
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.geminiModel = this.genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
        }
    }

    /**
     * Generates a fix command for a given error with fallback logic.
     * Priority: Groq -> Gemini -> Ollama
     */
    async getFix(error, command, context) {
        const prompt = `
      Context: Operating System is ${context.os}.
      Failed Command: ${command}
      Error Message: ${error}
      Task: Provide a single-line shell command to fix this. Returns only the command, no prose, no explanatory text, no markdown code blocks.
    `;

        // Attempt 1: Groq
        if (this.groq) {
            try {
                // console.log(chalk.gray('Trying Groq...'));
                const response = await this.#executeGroq(prompt);
                return { response: response.trim(), source: 'groq' };
            } catch (err) {
                console.warn(chalk.yellow(`\n⚠️  Groq failed: ${err.message}. Falling back...`));
            }
        }

        // Attempt 2: Gemini
        if (this.geminiModel) {
            try {
                // console.log(chalk.gray('Trying Gemini...'));
                const response = await this.#executeGemini(prompt);
                return { response: response.trim(), source: 'gemini' };
            } catch (err) {
                console.warn(chalk.yellow(`\n⚠️  Gemini failed: ${err.message}. Falling back...`));
            }
        }

        // Attempt 3: Ollama (Local)
        try {
            console.log(chalk.gray('Trying Local AI (Ollama)...'));
            const response = await this.#executeOllama(prompt);
            return { response: response.trim(), source: 'ollama' };
        } catch (err) {
            throw new Error(`All AI providers failed. Last error: ${err.message}`);
        }
    }

    async #executeGroq(prompt) {
        const start = Date.now();
        const chatCompletion = await this.groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            max_tokens: 100,
        });
        // console.log(`Groq Latency: ${Date.now() - start}ms`);
        return chatCompletion.choices[0]?.message?.content || "";
    }

    async #executeGemini(prompt) {
        const result = await this.geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async #executeOllama(prompt) {
        const model = process.env.OLLAMA_MODEL || 'llama3';
        const response = await ollama.chat({
            model: model,
            messages: [{ role: 'user', content: prompt }],
        });
        return response.message.content;
    }
}
