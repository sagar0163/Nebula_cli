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
                // Complex reasoning: HF Space preferred (infinite timeout usually), fallback to Groq -> Gemini
                return [providers.hf_space, providers.groq, providers.gemini];

            case 'shell':
            case 'quick-fix':
                // Fast response: Ollama (Local) -> Groq (Cloud Burst) -> Gemini -> HF Space (Slowest/Reliable)
                return [providers.ollama, providers.groq, providers.gemini, providers.hf_space];

            default:
                // General: Groq (Best performance/price) -> Ollama -> Gemini -> HF Space
                return [providers.groq, providers.ollama, providers.gemini, providers.hf_space];
        }
    }
}
