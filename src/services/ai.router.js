import { providers } from '../config/ai.providers.js';
import chalk from 'chalk';

export class AIRouter {
    static getProviders(task = 'general', options = {}) {
        const trainingMode = process.env.TRAINING_MODE === 'true';

        //console.log(chalk.blue(`🤖 Task: ${task} | Training: ${trainingMode}`));

        // PRIORITY 1: Training mode → ALWAYS HF Space (reliable)
        if (trainingMode) {
            if (options.verbose) console.log(chalk.magenta('🔒 TRAINING MODE: Using HF Space (fixed)'));
            return [providers.hf_space];
        }

        // PRIORITY 2: Task-specific routing (Failover lists)
        switch (task) {
            case 'planning':
            case 'deep-think':
            case 'training':
                // Complex reasoning: Claude -> GPT-4o -> HF Space -> Groq -> Gemini
                return [providers.anthropic, providers.openai, providers.hf_space, providers.groq, providers.gemini];

            case 'shell':
            case 'quick-fix':
                // Fast response: Ollama (Local) -> Groq (Cloud Burst) -> Gemini -> Claude -> GPT-4o -> HF Space
                return [providers.ollama, providers.groq, providers.gemini, providers.anthropic, providers.openai, providers.hf_space];

            case 'code':
            case 'refactor':
                // Code-focused: GPT-4o -> Claude -> Groq -> Gemini
                return [providers.openai, providers.anthropic, providers.groq, providers.gemini];

            default:
                // General: Groq (Best performance/price) -> Ollama -> Claude -> GPT-4o -> Gemini -> HF Space
                return [providers.groq, providers.ollama, providers.anthropic, providers.openai, providers.gemini, providers.hf_space];
        }
    }
}
