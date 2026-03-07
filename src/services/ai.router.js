// 2026 AI Router with Cost Optimization & Smart Routing
import { providers, costOptimizer, toolRegistry } from '../config/ai.providers.js';
import chalk from 'chalk';

export class AIRouter {
    // 2026: Enhanced routing with cost optimization
    static getProviders(task = 'general', options = {}) {
        const {
            reasoning = false,
            vision = false,
            streaming = false,
            lowCost = false,
        } = options;

        const trainingMode = process.env.TRAINING_MODE === 'true';

        // PRIORITY 1: Training mode → ALWAYS HF Space
        if (trainingMode) {
            if (options.verbose) console.log(chalk.magenta('🔒 TRAINING MODE: Using HF Space'));
            return [providers.hf_space];
        }

        // PRIORITY 2: Cost-optimized routing (2026 standard)
        if (lowCost) {
            if (options.verbose) console.log(chalk.cyan('💰 LOW COST MODE'));
            return [providers.ollama, providers.hf_space]; // Free tiers first
        }

        // PRIORITY 3: Task-specific routing with 2026 enhancements
        switch (task) {
            case 'planning':
            case 'deep-think':
            case 'reasoning':
                // Deep reasoning: Use R1 model or HF Space for complex tasks
                if (providers.deepseek) {
                    return [providers.deepseek, providers.hf_space, providers.groq];
                }
                return [providers.hf_space, providers.groq, providers.gemini];

            case 'vision':
            case 'multimodal':
                // Image/screenshot analysis
                return [providers.gemini, providers.ollama];

            case 'streaming':
            case 'interactive':
                // Real-time streaming (low latency)
                return [providers.ollama, providers.groq, providers.gemini];

            case 'shell':
            case 'quick-fix':
                // Fast response: Local → Fast Cloud → Premium
                return [providers.ollama, providers.groq, providers.gemini, providers.hf_space];

            case 'agent':
                // Autonomous agent: Need reasoning + execution
                return [providers.deepseek || providers.groq, providers.ollama, providers.hf_space];

            default:
                // General: Best performance/price (Groq is fastest)
                return [providers.groq, providers.ollama, providers.gemini, providers.hf_space];
        }
    }

    // 2026: Auto-select best provider based on context
    static autoRoute(contextLength, taskComplexity = 'medium') {
        const routing = costOptimizer.route(
            taskComplexity === 'simple' ? 'simple' : 
            taskComplexity === 'complex' ? 'reasoning' : 'general',
            contextLength
        );
        
        return routing.map(id => providers[id]).filter(Boolean);
    }

    // 2026: Get provider status (latency/cost)
    static getProviderStatus() {
        return Object.values(providers).map(p => ({
            id: p.id,
            name: p.name,
            latency: p.latency || 'unknown',
            cost: p.cost || 'unknown',
            streaming: p.streaming || false,
            supportsVision: p.supportsVision || false,
        }));
    }

    // 2026: Select tools for function calling
    static getTools(forTask = 'general') {
        // Return relevant tools based on task
        const baseTools = [
            toolRegistry.read_file,
            toolRegistry.list_directory,
            toolRegistry.execute_command,
        ];

        if (forTask === 'agent') {
            // Agent needs more tools
            return [
                ...baseTools,
                toolRegistry.git_status,
                toolRegistry.git_commit,
                toolRegistry.search_code,
            ];
        }

        return baseTools;
    }

    // 2026: Estimate cost for a request
    static estimateCost(prompt, providerId) {
        const provider = providers[providerId];
        if (!provider) return { estimated: 0, currency: 'USD' };

        const inputTokens = Math.ceil(prompt.length / 4); // Rough estimate
        const outputTokens = 500; // Expected output
        const totalTokens = inputTokens + outputTokens;

        // Parse cost from provider config
        const costPerMillion = parseFloat(provider.cost?.replace(/[^0-9.]/g, '') || '0');
        const estimated = (totalTokens / 1_000_000) * costPerMillion;

        return {
            estimated: estimated.toFixed(4),
            currency: 'USD',
            provider: provider.name,
        };
    }
}
