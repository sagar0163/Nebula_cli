import { ProjectFingerprint } from '../utils/project-fingerprint.js';
import { VectorMemory } from './vector-memory.js';
import { AIService } from './ai.service.js';
import chalk from 'chalk';

const vectorMemory = new VectorMemory();
const aiService = new AIService();

export class UniversalPredictor {
    /**
     * Universal prediction logic:
     * 1. Fingerprint Directory (Structure + Key Files)
     * 2. Check Vector Memory for "Similar Structures"
     * 3. If no match -> Ask AI (Generalize)
     */
    static async predict(cwd = process.cwd()) {
        const fingerprint = ProjectFingerprint.generate(cwd);
        const fingerprintStr = JSON.stringify(fingerprint);

        // 1. Vector Search (Learned Patterns)
        try {
            const similar = await vectorMemory.findSimilar(
                `PROJECT_STRUCTURE:${fingerprintStr.slice(0, 5000)}`,
                'PROJECT_SCOPE',
                0.90
            );

            if (similar.length > 0) {
                const best = similar[0];
                return {
                    command: best.fix,
                    confidence: best.similarity,
                    source: 'vector-memory',
                    rationale: 'Recognized similar project structure from memory'
                };
            }
        } catch (e) {
            // Vector db optional fail-safe
        }

        // 2. AI Universal Prediction (Ollama Llama 3.2)
        try {
            console.log(chalk.gray('   Trying Local AI (Ollama)...'));
            const { default: ollama } = await import('ollama');

            const prompt = `
Universal DevOps agent. Predict BEST next command for this project.
Analysis:
- Structure: ${Object.keys(fingerprint.structure).join(', ')}
- Manifests: ${Object.keys(fingerprint.manifests).join(', ')}
- Key Files: ${JSON.stringify(fingerprint.manifests)}

Reply ONLY with the one-line command to run/deploy. No markdown.
`;

            const response = await ollama.generate({
                model: 'llama3.2',
                prompt: prompt,
                options: { temperature: 0.1, timeout: 8000 }
            });

            const cmd = response.response.trim();
            if (cmd) {
                return {
                    command: cmd,
                    confidence: 0.85,
                    source: 'llama3.2',
                    rationale: 'AI analyzed project structure'
                };
            }
        } catch (e) {
            // Fallback to simpler heuristics if Ollama fails/not installed
        }

        // 3. Fallback to existing hybrid AI Service (Gemini/Groq)
        try {
            const diagnosis = await aiService.getFix(
                'HOW_TO_RUN_THIS_PROJECT',
                JSON.stringify(fingerprint, null, 2),
                { task: 'predict_run_command', cwd, skipLocal: true }
            );
            return {
                command: diagnosis.response,
                confidence: 0.6,
                source: 'cloud-ai',
                rationale: 'Cloud AI fallback'
            };
        } catch (e) {
            console.log(chalk.red(`\n⚠️  Cloud AI Fallback failed: ${e.message}`));
            return {
                command: 'ls -la',
                confidence: 0.1,
                source: 'fallback',
                rationale: 'Could not determine project type'
            };
        }
    }

    /**
     * Learns from a successful execution.
     * Stores: Structure -> Command
     */
    static async learn(cwd, command) {
        const fingerprint = ProjectFingerprint.generate(cwd);
        const fingerprintStr = JSON.stringify(fingerprint);

        await vectorMemory.store(
            `PROJECT_STRUCTURE:${fingerprintStr.slice(0, 5000)}`,
            'PROJECT_SCOPE', // Context tag
            command, // "Fix" slot used as Result
            { type: 'learned_execution' }
        );
    }
}
