// 2026 Integration Hub - Connect All Services
import AIService from './ai.service.js';
import AIRouter from './ai.router.js';
import MCPClient from './mcp-client.js';
import AgenticEngine from './agentic-engine.js';
import WebSearchService from './web-search.js';
import PersistentMemory from './persistent-memory.js';
import CollaborativeSession from './collaborative-mode.js';
import { streamingExecutor } from './streaming-executioner.js';
import { CodeSandbox, AISandbox } from './code-sandbox.js';
import { CollaborationServer, CollaborationClient } from './websocket-collaboration.js';

export class NebulaHub {
    constructor(options = {}) {
        this.options = options;
        
        // Initialize all services
        this.ai = new AIService();
        this.router = AIRouter;
        this.mcp = new MCPClient();
        this.agent = new AgenticEngine();
        this.search = new WebSearchService();
        this.memory = new PersistentMemory({ namespace: options.namespace || 'nebula' });
        this.executor = streamingExecutor;
        
        // Code sandbox
        this.sandbox = new CodeSandbox({
            timeout: options.sandboxTimeout || 30000,
            maxMemory: options.maxMemory || 512,
        });
        
        // WebSocket collaboration
        this.collaborationServer = null;
        this.collaborationClient = null;
    }

    // 2026: Unified query handler
    async query(input, options = {}) {
        const { mode = 'auto', stream = false } = options;

        switch (mode) {
            case 'search':
                return this.#handleSearch(input);
            
            case 'agent':
                return this.#handleAgent(input, options);
            
            case 'chat':
                return this.#handleChat(input, options);
            
            case 'execute':
                return this.#handleExecute(input, options);
            
            case 'sandbox':
                return this.#handleSandbox(input, options);
            
            case 'auto':
            default:
                return this.#handleAuto(input, options);
        }
    }

    async #handleSearch(query) {
        console.log('🔍 Searching the web...');
        const results = await this.search.aiSearch(query);
        
        // Save to memory
        await this.memory.remember(`search_${Date.now()}`, results, { 
            tags: ['search', 'web'] 
        });
        
        return results;
    }

    async #handleAgent(goal, options) {
        console.log(`🎯 Executing goal: ${goal}`);
        
        const result = await this.agent.executeGoal(goal, {
            maxSteps: options.maxSteps || 10,
            tools: true,
        });
        
        // Learn from execution
        await this.memory.learn(goal, result, ['agent', 'execution']);
        
        return result;
    }

    async #handleChat(prompt, options) {
        const context = await this.memory.getContext(5);
        const contextStr = context.map(c => c.value).join('\n');
        
        const fullPrompt = contextStr 
            ? `${contextStr}\n\nUser: ${prompt}`
            : prompt;
        
        return this.ai.getChat(fullPrompt);
    }

    async #handleExecute(command, options) {
        return this.executor.executeStream(command, {
            cwd: options.cwd,
            timeout: options.timeout || 60,
        });
    }

    async #handleSandbox(code, options) {
        const { language = 'javascript', timeout = 30000 } = options;
        
        return this.sandbox.execute(code, language, { timeout });
    }

    async #handleAuto(input, options) {
        // Analyze intent and route accordingly
        const intent = await this.ai.getChat(
            `Classify this request: "${input}"
            Output JSON: { "type": "search | agent | chat | execute | sandbox", "confidence": 0-1 }`
        );
        
        try {
            const parsed = JSON.parse(intent);
            
            if (parsed.confidence > 0.7) {
                return this.query(input, { ...options, mode: parsed.type });
            }
        } catch {
            // Default to chat
        }
        
        return this.#handleChat(input, options);
    }

    // Collaborative mode (local)
    startCollaboration(name = 'Nebula Team') {
        return new CollaborativeSession({ name });
    }

    // WebSocket collaboration server
    async startCollabServer(port = 8765) {
        this.collaborationServer = new CollaborationServer({ port });
        await this.collaborationServer.start();
        return this.collaborationServer;
    }

    // WebSocket collaboration client
    async joinCollabServer(url = 'ws://localhost:8765', userId) {
        this.collaborationClient = new CollaborationClient({ url, userId });
        await this.collaborationClient.connect();
        return this.collaborationClient;
    }

    // Execute code in sandbox
    async runCode(code, language = 'javascript', options = {}) {
        return this.sandbox.execute(code, language, options);
    }

    // Get all service statuses
    getStatus() {
        return {
            ai: {
                providers: AIRouter.getProviderStatus(),
            },
            memory: {
                namespace: this.memory.namespace,
            },
            search: {
                available: !!(process.env.BRAVE_API_KEY || process.env.TAVILY_API_KEY),
            },
            sandbox: {
                available: true,
                timeout: this.sandbox.timeout,
            },
            collaboration: {
                server: this.collaborationServer ? { active: true } : { active: false },
                client: this.collaborationClient ? { connected: true } : { connected: false },
            },
        };
    }
}

// Factory function for easy creation
export function createNebula(options = {}) {
    return new NebulaHub(options);
}

export default NebulaHub;
