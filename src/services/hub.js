// 2026 Integration Hub - Connect All Services
import AIService from './ai.service.js';
import AIRouter from './ai.router.js';
import MCPClient from './mcp-client.js';
import AgenticEngine from './agentic-engine.js';
import WebSearchService from './web-search.js';
import PersistentMemory from './persistent-memory.js';
import CollaborativeSession from './collaborative-mode.js';
import { streamingExecutor } from './streaming-executioner.js';

export class NebulaHub {
    constructor(options = {}) {
        this.options = options;
        
        // Initialize all services
        this.ai = new AIService();
        this.router = new AIRouter;
        this.mcp = new MCPClient();
        this.agent = new AgenticEngine();
        this.search = new WebSearchService();
        this.memory = new PersistentMemory({ namespace: options.namespace || 'nebula' });
        this.executor = streamingExecutor;
        
        // Collaborative mode
        this.collaboration = null;
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
        const context = await this.memory.getContext(limit = 5);
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

    async #handleAuto(input, options) {
        // Analyze intent and route accordingly
        const intent = await this.ai.getChat(
            `Classify this request: "${input}"
            Output JSON: { "type": "search | agent | chat | execute", "confidence": 0-1 }`
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

    // Collaborative mode
    startCollaboration(name = 'Nebula Team') {
        this.collaboration = new CollaborativeSession({ name });
        return this.collaboration;
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
                available: !!process.env.BRAVE_API_KEY || !!process.env.TAVILY_API_KEY,
            },
            collaboration: this.collaboration ? {
                active: true,
                agents: this.collaboration.getTeamStatus(),
            } : { active: false },
        };
    }
}

// Factory function for easy creation
export function createNebula(options = {}) {
    return new NebulaHub(options);
}

export default NebulaHub;
