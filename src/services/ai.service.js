import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';

export class AIService {
    constructor() {
        // Initialize Gemini only if API key is present
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-pro" });
        }
    }

    /**
     * Generates a fix command for a given error.
     * @param {string} error - The error message or stderr.
     * @param {string} command - The executed command that failed.
     * @param {object} context - System context (OS, etc).
     * @returns {Promise<{response: string, source: string}>}
     */
    async getFix(error, command, context) {
        // Decision logic: Prioritize Cloud (Gemini) if key exists, otherwise Local.
        const useLocal = this.#shouldUseLocal(error);
        const source = useLocal ? 'ollama' : 'gemini';

        const prompt = `
      Context: Operating System is ${context.os}.
      Failed Command: ${command}
      Error Message: ${error}
      Task: Provide a single-line shell command to fix this. Returns only the command, no prose, no markdown code blocks.
    `;

        try {
            const response = await this.#execute(source, prompt);
            return { response: response.trim(), source };
        } catch (err) {
            console.error(`AI Service Error (${source}):`, err.message);
            throw err;
        }
    }

    /**
     * Heuristic to decide between Local (Ollama) and Cloud (Gemini)
     */
    #shouldUseLocal(error) {
        // If Gemini key is configured, ALWAYS prefer it (User request: "do not pull ollama")
        if (process.env.GEMINI_API_KEY) return false;

        // Otherwise fallback to local
        return true;
    }

    async #execute(source, prompt) {
        if (source === 'gemini') {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } else {
            // Fallback to Ollama
            const model = process.env.OLLAMA_MODEL || 'llama3';
            const response = await ollama.chat({
                model: model,
                messages: [{ role: 'user', content: prompt }],
            });
            return response.message.content;
        }
    }
}
