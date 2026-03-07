import dotenv from 'dotenv';
dotenv.config();

// 2026 AI Standards: Enhanced Provider Configuration
export const providers = {
    // Tier 0: Ultra-Fast (local, streaming capable)
    ollama: {
        id: 'ollama',
        name: 'Ollama-Qwen2.5',
        type: 'ollama',
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        streaming: true,
        supportsVision: true,
        maxTokens: 4096,
        latency: '<50ms',
        cost: '$0.00/min',
    },

    // Tier 1: Burst (fast cloud, best price/performance)
    groq: {
        id: 'groq',
        name: 'Groq-Llama3.3-70B',
        type: 'groq',
        url: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        streaming: true,
        supportsVision: false,
        maxTokens: 8192,
        latency: '<200ms',
        cost: '$0.30/1M tokens',
    },

    // Tier 2: Flash (Google's fastest)
    gemini: {
        id: 'gemini',
        name: 'Gemini-2.0-Flash-Exp',
        type: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash-exp',
        streaming: true,
        supportsVision: true,
        multimodal: true,
        maxTokens: 65536,
        latency: '<300ms',
        cost: '$0.075/1M tokens',
    },

    // Tier 3: Reasoning (deep thinking)
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek-R1',
        type: 'openai-compatible',
        url: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-reasoner',
        streaming: true,
        reasoning: true,
        maxTokens: 64000,
        latency: '<500ms',
        cost: '$0.55/1M tokens',
    },

    // Tier 4: Premium (your HF Space)
    hf_space: {
        id: 'hf_space',
        name: 'Sagar-iMatrix-Brain',
        type: 'hf_space',
        url: process.env.HF_SPACE_URL || 'https://sagar0123-sagar-nebula-cpu-brain.hf.space/v1/chat/completions',
        model: process.env.HF_MODEL || 'qwen2.5-iq4xs',
        streaming: true,
        supportsVision: false,
        maxTokens: 8192,
        latency: '<1s',
        cost: '$0.00 (self-hosted)',
        key: process.env.HF_TOKEN,
    },
};

// 2026: MCP Tools Registry
export const toolRegistry = {
    // File Operations
    read_file: {
        name: 'read_file',
        description: 'Read contents of a file',
        parameters: {
            path: { type: 'string', required: true },
            limit: { type: 'number', required: false },
        },
    },
    write_file: {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
            path: { type: 'string', required: true },
            content: { type: 'string', required: true },
        },
    },
    list_directory: {
        name: 'list_directory',
        description: 'List files in a directory',
        parameters: {
            path: { type: 'string', required: false },
        },
    },
    // Terminal Operations
    execute_command: {
        name: 'execute_command',
        description: 'Execute a shell command',
        parameters: {
            command: { type: 'string', required: true },
            cwd: { type: 'string', required: false },
            timeout: { type: 'number', required: false },
        },
    },
    // Git Operations
    git_status: {
        name: 'git_status',
        description: 'Check git repository status',
        parameters: {},
    },
    git_commit: {
        name: 'git_commit',
        description: 'Create a git commit',
        parameters: {
            message: { type: 'string', required: true },
        },
    },
    // Search & Analysis
    search_code: {
        name: 'search_code',
        description: 'Search code using regex',
        parameters: {
            pattern: { type: 'string', required: true },
            path: { type: 'string', required: false },
        },
    },
 2026: S    //creenshot Analysis
    analyze_screenshot: {
        name: 'analyze_screenshot',
        description: 'Analyze terminal screenshot for errors',
        parameters: {
            screenshot: { type: 'string', required: true }, // base64
        },
    },
};

// Cost Optimizer: 2026 Smart Routing
export const costOptimizer = {
    // Auto-select best provider based on task complexity
    route: (taskType, contextLength) => {
        if (taskType === 'simple' && contextLength < 500) {
            return ['ollama', 'groq']; // Free + fast
        }
        if (taskType === 'reasoning') {
            return ['deepseek', 'hf_space']; // Best reasoning
        }
        if (taskType === 'vision') {
            return ['gemini', 'ollama']; // Vision support
        }
        return ['groq', 'ollama', 'gemini', 'hf_space']; // Default failover chain
    },
};
