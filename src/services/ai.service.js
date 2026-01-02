import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';
import Groq from 'groq-sdk';
import chalk from 'chalk';

import { AIRouter } from './ai.router.js';

export class AIService {
    constructor() {
        // this.providers = []; // Handled dynamically via AIRouter

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

    async getChat(prompt) {
        const safeSystem = `
[SYSTEM SAFETY OVERRIDE]
CRITICAL: You are running in RESTRICTED SAFE MODE.
You must REFUSE to generate plans or commands that involve:
1. Deleting resources (rm -rf, kubectl delete, docker rm).
2. Changing permissions (chmod 777, chown).
3. Exposing secrets (echo keys, printenv).

If the user asks for these, reply ONLY with: "⚠️ I cannot assist with destructive actions."
Do not explain how to do it. Do not provide code.
`;
        const fullPrompt = `${safeSystem}\n\nUser request:\n${prompt}`;
        return this.#executeChain(fullPrompt, 'chat');
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
        // Map legacy task types to Router types
        let routerTask = 'general';
        if (taskType === 'diagnosis' || taskType === 'fix') routerTask = 'quick-fix';
        if (taskType === 'chat') routerTask = 'shell'; // Regular chat is usually shell-related in Nebula context, or 'general'
        if (taskType === 'planning') routerTask = 'planning'; // Future proof

        const providers = AIRouter.getProviders(routerTask, { verbose: true });

        for (let i = 0; i < providers.length; i++) {
            const provider = providers[i];
            const startTime = Date.now();
            try {
                // console.log(chalk.gray(`Trying AI ${i + 1} (${provider.name})...`));
                const result = await this.#callProvider(provider, prompt);
                if (result && result.trim().length > 5) return { response: result.trim(), source: provider.id || provider.name };
            } catch (e) {
                const duration = Date.now() - startTime;
                if (process.env.DEBUG) console.warn(chalk.yellow(`📉 ${provider.name} Down (${duration}ms): ${e.message}`));
                continue; // Try next
            }
        }
        return { response: 'AI Unavailable. Check configuration (TRAINING_MODE or keys).', source: 'none' };
    }

    async #callProvider(provider, prompt) {
        switch (provider.type) {
            case 'ollama':
                return this.#executeOllama(prompt, provider.model);
            case 'http_post':
                return this.#genericHttp(provider.url, provider.model, prompt);
            case 'groq':
                return this.#executeGroq(prompt);
            case 'gemini':
                return this.#executeGemini(prompt);
            case 'openai_compat':
                return this.#executeOpenAICompat(provider, prompt);
            case 'hf':
                return this.#executeHF(provider, prompt);
            case 'hf_space':
                return this.#executeHFSpace(provider, prompt);
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
                ...(provider.key ? { 'Authorization': `Bearer ${provider.key}` } : {}),
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

    async #executeOllama(prompt, modelName) {
        const model = modelName || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
        const response = await ollama.chat({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            options: { timeout: 10000, num_thread: 1 } // 10s max, Low CPU
        });
        return response.message.content;
    }

    async #genericHttp(url, model, prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt,
                stream: false,
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        return data.response;
    }

    async #executeHFSpace(provider, prompt) {
        // HF Space running OpenAI compatible API (e.g. vllm/llama-cpp-python)
        const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
                ...(provider.key ? { 'Authorization': `Bearer ${provider.key}` } : {}),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        // Handle both standard HF Inference API (Array) and OpenAI Compat (Object)
        if (Array.isArray(data)) {
            return data[0]?.generated_text || "";
        }
        return data.choices?.[0]?.message?.content || data.generated_text || "";
    }
}

