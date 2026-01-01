import ProjectScanner from '../utils/project-scanner.js';
import { AIService } from './ai.service.js';
import { VectorMemory } from './vector-memory.js';

const aiService = new AIService();
const vectorMemory = new VectorMemory();

export class CommandPredictor {
    /**
     * "How do I run this project?" → AI analyzes dir structure
     */
    static async predictNextCommand(cwd = process.cwd()) {
        const analysis = ProjectScanner.analyze(cwd);

        // 1. Heuristic High Confidence Match
        if (analysis.confidence > 0.89 && analysis.suggestedCommands.length > 0) {
            return {
                command: analysis.suggestedCommands[0],
                source: 'heuristic',
                confidence: analysis.confidence,
                rationale: `Detected ${analysis.type} project structure`
            };
        }

        // 2. Vector-first: Has user run similar projects before?
        try {
            const similarProjects = await vectorMemory.findSimilar(
                `project:${analysis.type}:${cwd}`,
                '',
                0.85
            );

            if (similarProjects.length) {
                return {
                    command: similarProjects[0].fix, // storing "fix" as command
                    source: 'vector-cache',
                    confidence: similarProjects[0].similarity,
                    rationale: 'Similar project run before',
                };
            }
        } catch (e) {
            // Warning managed in vector memory
        }

        // 3. AI analysis with full fingerprint
        const prompt = `
You are a DevOps engineer. Analyze this project structure and suggest the SINGLE BEST "next command" to run.

PROJECT FINGERPRINT:
${JSON.stringify(analysis.fingerprint, null, 2)}

CONSTRAINTS:
- Reply with ONLY the command (no explanation)
- Make it work for current directory
- Prefer non-destructive commands first
- For Helm/Tyk: helm upgrade --install
- For Node.js: npm install && npm run dev

NEXT COMMAND:`;

        try {
            const diagnosis = await aiService.getFix('HOW_TO_RUN_PROJECT', 'predict', {
                projectFingerprint: analysis
            });

            // If AI returns a suggested command (it usually returns { response, source })
            // We need to parse it cleanly. The prompt asks for ONLY the command.

            return {
                command: diagnosis.response,
                source: diagnosis.source,
                confidence: 0.85, // AI confidence estimation
                rationale: `AI analyzed ${analysis.fingerprint.files.length} files`,
            };
        } catch (error) {
            return {
                command: 'ls -la',
                source: 'fallback',
                confidence: 0.1,
                rationale: 'Could not determine project type, listing files.'
            };
        }
    }
}
