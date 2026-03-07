// 2026 Agentic Engine - Simplified for CLI self-healing
import AIService from './ai.service.js';
import MCPClient from './mcp-client.js';

export class AgenticEngine {
    constructor() {
        this.ai = new AIService();
        this.mcp = new MCPClient();
        this.maxSteps = 5;
    }

    async executeGoal(goal, options = {}) {
        const { maxSteps = this.maxSteps } = options;
        
        let context = '';
        
        for (let step = 0; step < maxSteps; step++) {
            const prompt = this.#buildPrompt(goal, context);
            
            try {
                const response = await this.ai.getFix(prompt, context);
                const parsed = this.#parseResponse(response);
                
                if (parsed.steps && parsed.steps.length > 0) {
                    for (const cmd of parsed.steps) {
                        const result = await this.mcp.executeTool('execute_command', { command: cmd });
                        
                        if (!result.success) {
                            context += `\nError: ${result.error}\nCommand: ${cmd}`;
                            continue;
                        }
                        
                        context += `\nExecuted: ${cmd}\nOutput: ${result.stdout || 'OK'}`;
                        
                        // Check if it worked
                        if (result.stdout && !result.error) {
                            return { success: true, steps: parsed.steps, output: result.stdout };
                        }
                    }
                }
                
                // If we got here, no more steps or didn't fix
                if (parsed.done) {
                    return { success: true, steps: parsed.steps };
                }
                
            } catch (err) {
                return { success: false, error: err.message };
            }
        }
        
        return { success: false, error: 'Max steps reached' };
    }

    #buildPrompt(goal, context) {
        return `
Goal: ${goal}
Previous: ${context || 'None'}

Return JSON with:
{
  "steps": ["command 1", "command 2"],
  "done": true/false
}

Only include commands that will fix the issue.
`;
    }

    #parseResponse(response) {
        try {
            // Try to extract JSON from response
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch {}
        return { steps: [], done: false };
    }
}

export default AgenticEngine;
