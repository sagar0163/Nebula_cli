import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const providers = {
    // Tier 1: Instant (local)
    ollama: {
        id: 'ollama',
        name: 'Ollama-0.5B',
        type: 'ollama',
        url: 'http://localhost:11434/v1/chat/completions',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
    },

    // Tier 2: Burst (fast cloud)
    groq: {
        id: 'groq',
        name: 'Groq-Llama3.1-70B',
        type: 'groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.1-70b-versatile',
    },

    gemini: {
        id: 'gemini',
        name: 'Gemini-2.0-Flash',
        type: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash',
    },

    // Tier 3: Infinite (your HF Space)
    hf_space: {
        id: 'hf_space',
        name: 'Sagar-iMatrix-Brain',
        type: 'hf_space',
        url: process.env.HF_SPACE_URL || 'https://sagar0123-sagar-nebula-cpu-brain.hf.space/v1/chat/completions',
        model: 'qwen2.5-iq4xs',
        // HF Spaces might use Bearer token if private, or just open. 
        // Assuming open or key handling is in the service if needed.
        key: process.env.HF_TOKEN
    },
};
