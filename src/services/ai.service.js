import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';

export class AIService {
    constructor() {
        // Initialize Gemini only if API key is present, otherwise we'll fallback or error
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
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
        // If error is short or looks like a simple syntax error, keep it local.
        // Also if no Gemini API key is configured, forced to use local.
        if (!process.env.GEMINI_API_KEY) return true;

        // Example heuristic: Privacy-sensitive or simple errors -> Local
        return error.length < 200 && !error.includes('stack trace');
    }

    async #execute(source, prompt) {
        if (source === 'gemini') {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } else {
            // Fallback to Ollama (llama3 by default, configurable)
            // Ensure user has 'llama3' or 'mistral' pulled
            const response = await ollama.chat({
                model: 'llama3',
                messages: [{ role: 'user', content: prompt }],
            });
            return response.message.content;
        }
    }
}
