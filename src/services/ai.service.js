// 2026 AI Service: Streaming + Function Calling + MCP
import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama from 'ollama';
import Groq from 'groq-sdk';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { AIRouter } from './ai.router.js';
import { toolRegistry } from '../config/ai.providers.js';

export class AIService extends EventEmitter {
    constructor() {
        super();
        this.tools = this.#buildTools();
        
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.geminiModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        }
    }

    // 2026: Build MCP-compatible tools
    #buildTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read contents of a file',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'File path to read' },
                            limit: { type: 'number', description: 'Max lines to read' },
                        },
                        required: ['path'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'execute_command',
                    description: 'Execute a shell command',
                    parameters: {
                        type: 'object',
                        properties: {
                            command: { type: 'string', description: 'Command to execute' },
                            cwd: { type: 'string', description: 'Working directory' },
                        },
                        required: ['command'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'list_directory',
                    description: 'List files in a directory',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Directory path' },
                        },
                    },
                },
            },
        ];
    }

    // 2026: Streaming Response Support
    async *streamChat(prompt, options = {}) {
        const providers = AIRouter.getProviders('chat', options);
        const toolChoice = options.tools ? { tools: this.tools } : null;

        for (const provider of providers) {
            try {
                yield* await this.#streamProvider(provider, prompt, toolChoice);
                return; // Success
            } catch (err) {
                console.log(chalk.yellow(`⚠️ ${provider.id} failed: ${err.message}`));
                continue; // Try next provider
            }
        }
        throw new Error('All providers failed');
    }

    async *#streamProvider(provider, prompt, toolChoice) {
        if (provider.type === 'ollama') {
            yield* this.#streamOllama(provider, prompt);
        } else if (provider.type === 'groq') {
            yield* this.#streamGroq(provider, prompt, toolChoice);
        } else if (provider.type === 'gemini') {
            yield* this.#streamGemini(provider, prompt);
        }
    }

    // Ollama Streaming
    async *#streamOllama(provider, prompt) {
        const response = await ollama.chat({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        });

        for await (const chunk of response) {
            this.emit('token', chunk.message.content);
            yield chunk.message.content;
        }
    }

    // Groq Streaming with Function Calling
    async *#streamGroq(provider, prompt, toolChoice) {
        const response = await this.groq.chat.completions.create({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            ...toolChoice,
        });

        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                this.emit('token', content);
                yield content;
            }
            // Handle function calls
            if (chunk.choices[0]?.delta?.tool_calls) {
                this.emit('tool_call', chunk.choices[0].delta.tool_calls);
            }
        }
    }

    // Gemini Streaming (Multimodal)
    async *#streamGemini(provider, prompt) {
        // Gemini uses different streaming API
        const result = await this.geminiModel.generateContentStream(prompt);
        for await (const chunk of result.stream) {
            const content = chunk.text();
            this.emit('token', content);
            yield content;
        }
    }

    // 2026: Multimodal Analysis (Screenshot/Diff)
    async analyzeImage(base64Image, prompt = 'What errors do you see?') {
        try {
            const result = await this.geminiModel.generateContent([
                { text: prompt },
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: base64Image,
                    },
                },
            ]);
            return result.response.text();
        } catch (err) {
            return `Image analysis failed: ${err.message}`;
        }
    }

    // 2026: Autonomous Agent Mode
    async agentExecute(goal, maxSteps = 5) {
        const context = { goal, steps: [], completed: false };
        
        for (let step = 0; step < maxSteps; step++) {
            const prompt = `
Goal: ${goal}
Completed steps: ${context.steps.join('\n')}

Determine next action. Output JSON:
{
  "action": "think | execute | read | search",
  "command": "shell command if execute",
  "file": "file path if read", 
  "reasoning": "why this action"
}
`;
            const response = await this.getChat(prompt);
            const parsed = JSON.parse(response);
            
            context.steps.push(`${step + 1}. ${parsed.action}: ${parsed.command || parsed.file}`);
            
            if (parsed.action === 'execute') {
                // Execute and continue
                const { executeSystemCommand } = await import('../utils/executioner.js');
                try {
                    const output = await executeSystemCommand(parsed.command);
                    context.steps.push(`   → ${output.substring(0, 200)}`);
                } catch (e) {
                    context.steps.push(`   → Error: ${e.message}`);
                }
            }
            
            // Check if goal achieved
            if (context.steps.length > maxSteps) break;
        }
        
        return context;
    }

    // Legacy methods (kept for compatibility)
    async getDiagnosis(prompt, signal) {
        return this.#executeChain(prompt, 'diagnosis', signal);
    }

    async getFix(prompt, contextStr, options = {}) {
        const fullPrompt = `
Context: ${contextStr || 'Shell Command Fix'}
Task: You are a high-precision execution engine.
Output STRICT JSON ONLY. No markdown, no introspection.

Format:
{
  "steps": ["command 1", "command 2"]
}

User Prompt: ${prompt}
`;
        return this.#executeChain(fullPrompt, 'fix', options.signal);
    }

    async getChat(prompt, signal) {
        const providers = AIRouter.getProviders('chat', {});
        return this.#executeChain(`${prompt}\n\nOutput only the answer, no explanations.`, providers[0], signal);
    }

    async #executeChain(prompt, taskType, signal) {
        const providers = AIRouter.getProviders(taskType, {});
        
        for (const provider of providers) {
            try {
                return await this.#executeWithProvider(provider, prompt, signal);
            } catch (err) {
                console.log(chalk.yellow(`⚠️ ${provider.id} failed: ${err.message}`));
                continue;
            }
        }
        throw new Error('All AI providers failed');
    }

    async #executeWithProvider(provider, prompt, signal) {
        if (provider.type === 'ollama') {
            const response = await ollama.chat({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }],
            });
            return response.message.content;
        }
        
        if (provider.type === 'groq') {
            const response = await this.groq.chat.completions.create({
                model: provider.model,
                messages: [{ role: 'user', content: prompt }],
            });
            return response.choices[0].message.content;
        }
        
        if (provider.type === 'gemini') {
            const result = await this.geminiModel.generateContent(prompt);
            return result.response.text();
        }
        
        throw new Error(`Unknown provider: ${provider.type}`);
    }
}

export default AIService;
