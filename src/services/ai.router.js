// 2026 AI Router - Simplified
import { providers } from '../config/ai.providers.js';

export class AIRouter {
    static getProviders(task = 'general', options = {}) {
        const trainingMode = process.env.TRAINING_MODE === 'true';

        // Training mode
        if (trainingMode) {
            return [providers.hf_space];
        }

        // Task-specific routing
        switch (task) {
            case 'planning':
            case 'deep-think':
            case 'reasoning':
                return [providers.deepseek, providers.groq, providers.gemini].filter(Boolean);

            case 'shell':
            case 'quick-fix':
            case 'fix':
                return [providers.ollama, providers.groq, providers.gemini, providers.hf_space].filter(Boolean);

            case 'chat':
            default:
                return [providers.groq, providers.ollama, providers.gemini, providers.hf_space].filter(Boolean);
        }
    }

    static getProviderStatus() {
        return Object.values(providers).map(p => ({
            id: p.id,
            name: p.name,
            latency: p.latency || 'unknown',
            cost: p.cost || 'unknown',
        }));
    }
}

export default AIRouter;
