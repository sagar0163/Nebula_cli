import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';
import Groq from 'groq-sdk';
import chalk from 'chalk';

// Fallback Chain Configuration
const FALLBACK_PROVIDERS = [
    { name: 'groq', key: process.env.GROQ_API_KEY, type: 'groq' },
    { name: 'google_ai_studio', key: process.env.GEMINI_API_KEY, type: 'gemini', model: 'gemini-2.0-flash' }, // Highest limits
    { name: 'openrouter', key: process.env.OPENROUTER_KEY, type: 'openai_compat', url: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.1-70b-instruct:free' },
    { name: 'deepinfra', key: process.env.DEEPINFRA_KEY, type: 'openai_compat', url: 'https://api.deepinfra.com/v1/openai', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct' },
    { name: 'huggingface', key: process.env.HF_TOKEN, type: 'hf', url: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium' },
    { name: 'ollama_local', type: 'ollama', model: 'llama3.2' }
];

export class AIService {
    constructor() {
        this.providers = FALLBACK_PROVIDERS.filter(p => (p.key || p.type === 'ollama'));

        // Initialize SDKs logic is now dynamic per request to allow failover
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.geminiModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        }
    }

    async getDiagnosis(prompt) {
        return this.#executeChain(prompt, 'diagnosis');
    }

    async getFix(prompt, contextStr, options = {}) {
        const fullPrompt = `
      Context: ${contextStr || 'Shell Command Fix'}
      Task: Provide a single-line shell command fix or diagnosis.
      
      User Prompt: 
      ${prompt}
    `;
        return this.#executeChain(fullPrompt, 'fix');
    }

    async summarizeReadme(content) {
        const prompt = `
        Resource: README.md
        Content:
        ${content.slice(0, 5000)}

        Task: Extract deployment information into JSON.
        Output Format (JSON only):
        {
            "deployCmd": "exact command to deploy/install",
            "namespace": "target namespace if mentioned",
            "secrets": "any required secrets",
            "prerequisites": "list of prerequisites"
        }
        `;
        const result = await this.#executeChain(prompt, 'summary');
        try {
            return JSON.parse(result.response.replace(/```json|```/g, '') || '{}');
        } catch (e) {
            return {};
        }
    }

    async #executeChain(prompt, taskType) {
        for (const provider of this.providers) {
            try {
                // console.log(chalk.gray(`Trying ${provider.name}...`));
                const result = await this.#callProvider(provider, prompt);
                if (result) return { response: result.trim(), source: provider.name };
            } catch (e) {
                console.warn(chalk.yellow(`⚠️  ${provider.name} failed: ${e.message}`));
                continue; // Try next
            }
        }
        return { response: 'AI Unavailable', source: 'none' };
    }

    async #callProvider(provider, prompt) {
        switch (provider.type) {
            case 'groq':
                return this.#executeGroq(prompt);
            case 'gemini':
                return this.#executeGemini(prompt);
            case 'openai_compat':
                return this.#executeOpenAICompat(provider, prompt);
            case 'hf':
                return this.#executeHF(provider, prompt);
            case 'ollama':
                return this.#executeOllama(prompt);
            default:
                return null;
        }
    }

    async #executeGroq(prompt) {
        const chatCompletion = await this.groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            max_tokens: 300,
        });
        return chatCompletion.choices[0]?.message?.content || "";
    }

    async #executeGemini(prompt) {
        const result = await this.geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async #executeOpenAICompat(provider, prompt) {
        const response = await fetch(`${provider.url}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.key}`,
                'Content-Type': 'application/json',
                // OpenRouter specific
                ...(provider.name === 'openrouter' ? { 'HTTP-Referer': 'https://nebula-cli.com', 'X-Title': 'Nebula CLI' } : {})
            },
            body: JSON.stringify({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    }

    async #executeHF(provider, prompt) {
        const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        return data[0]?.generated_text || "";
    }

    async #executeOllama(prompt) {
        const model = process.env.OLLAMA_MODEL || 'llama3.2';
        const response = await ollama.chat({
            model: model,
            messages: [{ role: 'user', content: prompt }],
        });
        return response.message.content;
    }
}
