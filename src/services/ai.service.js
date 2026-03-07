// 2026 AI Service - Simplified streaming + failover
import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';
import Groq from 'groq-sdk';
import AIRouter from './ai.router.js';

export class AIService {
    constructor() {
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.geminiModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        }
    }

    // Get fix for failed command
    async getFix(prompt, context, options = {}) {
        const fullPrompt = `
Context: ${context || 'Shell Command'}
Task: Return JSON with commands to fix the issue.

Format:
{"steps": ["command1", "command2"], "done": true/false}

User: ${prompt}
`;
        return this.#executeWithFailover(fullPrompt, 'fix');
    }

    // Chat
    async getChat(prompt) {
        return this.#executeWithFailover(prompt, 'chat');
    }

    // Diagnosis
    async getDiagnosis(prompt, signal) {
        return this.#executeWithFailover(prompt, 'diagnosis', signal);
    }

    async *streamChat(prompt) {
        const providers = AIRouter.getProviders('chat', {});
        
        for (const provider of providers) {
            try {
                yield* this.#streamProvider(provider, prompt);
                return;
            } catch (err) {
                continue;
            }
        }
    }

    async *#streamProvider(provider, prompt) {
        if (provider.type === 'ollama') {
            const response = await ollama.chat({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of response) {
                yield chunk.message.content;
            }
        }
        // Add more providers as needed
    }

    async #executeWithFailover(prompt, taskType, signal) {
        const providers = AIRouter.getProviders(taskType, {});
        
        for (const provider of providers) {
            try {
                return await this.#executeProvider(provider, prompt, signal);
            } catch (err) {
                continue;
            }
        }
        throw new Error('All AI providers failed');
    }

    async #executeProvider(provider, prompt, signal) {
        if (provider.type === 'ollama') {
            const response = await ollama.chat({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }],
            });
            return response.message.content;
        }
        
        if (provider.type === 'groq') {
            const response = await this.groq.chat.completions.create({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }],
            });
            return response.choices[0].message.content;
        }
        
        if (provider.type === 'gemini') {
            const result = await this.geminiModel.generateContent(prompt);
            return result.response.text();
        }
        
        throw new Error(`Unknown provider: ${provider.type}`);
    }
}

export default AIService;
