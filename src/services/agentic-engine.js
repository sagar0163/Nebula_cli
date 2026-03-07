// 2026 Agentic Workflow Engine
import chalk from 'chalk';
import { EventEmitter } from 'events';
import AIService from './ai.service.js';
import MCPClient from './mcp-client.js';

export class AgenticEngine extends EventEmitter {
    constructor() {
        super();
        this.ai = new AIService();
        this.mcp = new MCPClient();
        this.maxSteps = 10;
        this.currentExecution = null;
    }

    // 2026: Execute goal with autonomous planning
    async executeGoal(goal, options = {}) {
        const {
            maxSteps = this.maxSteps,
            verbose tools = true = false,
           ,
        } = options;

        console.log(chalk.cyan.bold(`🎯 Goal: ${goal}`));
        
        this.currentExecution = {
            goal,
            steps: [],
            startTime: Date.now(),
            status: 'running',
        };

        let context = '';
        let step = 0;

        while (step < maxSteps) {
            step++;
            console.log(chalk.gray(`\n📍 Step ${step}/${maxSteps}`));

            // Build prompt with context
            const prompt = this.#buildStepPrompt(goal, context, step);

            try {
                // Get AI response with tools if enabled
                const response = await this.ai.getFix(prompt, context, {
                    signal: null,
                });

                let parsed;
                try {
                    parsed = JSON.parse(response);
                } catch {
                    // Not JSON, treat as thought
                    context += `\nThought: ${response}`;
                    if (verbose) console.log(chalk.gray(`💭 ${response}`));
                    continue;
                }

                // Handle response types
                if (parsed.thought) {
                    context += `\nThought: ${parsed.thought}`;
                    if (verbose) console.log(chalk.gray(`💭 ${parsed.thought}`));
                }

                if (parsed.action === 'execute' && parsed.command) {
                    console.log(chalk.yellow(`⚡ Executing: ${parsed.command}`));
                    
                    const result = await this.mcp.executeTool('execute_command', {
                        command: parsed.command,
                        cwd: options.cwd || process.cwd(),
                    });

                    const output = result.stdout || result.error || 'No output';
                    context += `\n→ Output: ${output.substring(0, 500)}`;
                    
                    this.currentExecution.steps.push({
                        step,
                        action: 'execute',
                        command: parsed.command,
                        output: output.substring(0, 200),
                    });

                    if (verbose) console.log(chalk.green(`✅ ${output.substring(0, 100)}`));
                }

                if (parsed.action === 'read' && parsed.file) {
                    console.log(chalk.blue(`📄 Reading: ${parsed.file}`));
                    
                    const content = await this.mcp.executeTool('read_file', {
                        path: parsed.file,
                        limit: parsed.limit || 100,
                    });

                    context += `\n→ File content: ${content.substring(0, 500)}`;
                    
                    this.currentExecution.steps.push({
                        step,
                        action: 'read',
                        file: parsed.file,
                    });
                }

                if (parsed.done || parsed.completed) {
                    console.log(chalk.green.bold(`\n✅ Goal completed in ${step} steps!`));
                    this.currentExecution.status = 'completed';
                    this.currentExecution.duration = Date.now() - this.currentExecution.startTime;
                    return this.currentExecution;
                }

            } catch (err) {
                console.log(chalk.red(`❌ Step ${step} failed: ${err.message}`));
                this.currentExecution.steps.push({
                    step,
                    error: err.message,
                });
                context += `\nError: ${err.message}`;
            }
        }

        console.log(chalk.yellow(`\n⚠️ Max steps reached (${maxSteps})`));
        this.currentExecution.status = 'max_steps';
        this.currentExecution.duration = Date.now() - this.currentExecution.startTime;
        
        return this.currentExecution;
    }

    // 2026: Streaming execution for real-time feedback
    async *executeGoalStream(goal, options = {}) {
        const {
            maxSteps = this.maxSteps,
            tools = true,
        } = options;

        this.emit('start', { goal });
        
        let context = '';
        let step = 0;

        while (step < maxSteps) {
            step++;
            this.emit('stepStart', { step, maxSteps });

            const prompt = this.#buildStepPrompt(goal, context, step);

            try {
                // Stream the response
                for await (const token of await this.ai.streamChat(prompt)) {
                    this.emit('token', token);
                    yield token;
                }

            } catch (err) {
                this.emit('error', { step, error: err.message });
            }

            this.emit('stepEnd', { step });
        }

        this.emit('complete', this.currentExecution);
    }

    #buildStepPrompt(goal, context, step) {
        return `
You are an autonomous agent executing: "${goal}"

Context so far:
${context || 'Starting fresh'}

Current step: ${step}

Output JSON with your next action:
{
  "thought": "What you're thinking",
  "action": "think | execute | read | search | done",
  "command": "shell command (if action=execute)",
  "file": "file path (if action=read)",
  "search": "search term (if action=search)",
  "done": true/false (if goal is achieved)
}

Be precise. Execute commands when needed. Read files to understand. Think step by step.
`;
    }

    // Get execution status
    getStatus() {
        return this.currentExecution;
    }
}

export default AgenticEngine;
