// 2026 AI Providers - Essential only
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const providers = {
    ollama: {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'ollama',
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    },
    groq: {
        id: 'groq',
        name: 'Groq (Fast)',
        type: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
    },
    gemini: {
        id: 'gemini',
        name: 'Gemini',
        type: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash-exp',
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek (Reasoning)',
        type: 'openai-compatible',
        url: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-reasoner',
    },
    hf_space: {
        id: 'hf_space',
        name: 'HF Space (Your Brain)',
        type: 'hf_space',
        url: process.env.HF_SPACE_URL || 'https://sagar0123-sagar-nebula-cpu-brain.hf.space/v1/chat/completions',
        model: process.env.HF_MODEL || 'qwen2.5-iq4xs',
        key: process.env.HF_TOKEN,
    },
};
