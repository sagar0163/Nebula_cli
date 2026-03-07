// 2026 Secure Code Execution Sandbox
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CodeSandbox {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000; // 30s default
        this.maxMemory = options.maxMemory || 512; // MB
        this.maxOutput = options.maxOutput || 1024 * 1024; // 1MB
        this.sandboxDir = options.sandboxDir || path.join(os.tmpdir(), 'nebula-sandbox');
        this.allowedLanguages = options.languages || ['javascript', 'python', 'bash'];
        
        this.#ensureSandboxDir();
    }

    #ensureSandboxDir() {
        if (!fs.existsSync(this.sandboxDir)) {
            fs.mkdirSync(this.sandboxDir, { recursive: true });
        }
    }

    // Create isolated sandbox environment
    createSession() {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const sessionDir = path.join(this.sandboxDir, sessionId);
        
        fs.mkdirSync(sessionDir, { recursive: true });
        
        return new SandboxSession(sessionId, sessionDir, {
            timeout: this.timeout,
            maxMemory: this.maxMemory,
            maxOutput: this.maxOutput,
            allowedLanguages: this.allowedLanguages,
        });
    }

    // Execute code directly (convenience method)
    async execute(code, language, options = {}) {
        const session = this.createSession();
        
        try {
            const result = await session.run(code, language, options);
            return result;
        } finally {
            session.cleanup();
        }
    }

    // Cleanup all sessions
    cleanup() {
        if (fs.existsSync(this.sandboxDir)) {
            fs.rmSync(this.sandboxDir, { recursive: true, force: true });
            this.#ensureSandboxDir();
        }
    }
}

// Individual sandbox session
class SandboxSession {
    constructor(id, dir, options) {
        this.id = id;
        this.dir = dir;
        this.options = options;
        this.process = null;
        this.started = null;
    }

    async run(code, language, options = {}) {
        const { args = [], env = {}, cwd = this.dir } = options;
        
        this.started = Date.now();
        
        // Validate language
        if (!this.options.allowedLanguages.includes(language)) {
            throw new Error(`Language not allowed: ${language}`);
        }

        // Write code to file
        const file = this.#getFileForLanguage(language);
        const filePath = path.join(this.dir, file);
        fs.writeFileSync(filePath, code);

        // Build command
        const { command, cmdArgs } = this.#buildCommand(language, filePath, args);

        return this.#execute(command, cmdArgs, { cwd, env, timeout: options.timeout });
    }

    #getFileForLanguage(language) {
        const extensions = {
            javascript: 'main.js',
            python: 'main.py',
            bash: 'script.sh',
            typescript: 'main.ts',
            go: 'main.go',
            rust: 'main.rs',
        };
        return extensions[language] || `main.${language}`;
    }

    #buildCommand(language, filePath, args) {
        switch (language) {
            case 'javascript':
                return { command: 'node', cmdArgs: [filePath, ...args] };
            case 'python':
                return { command: 'python3', cmdArgs: [filePath, ...args] };
            case 'bash':
                return { command: 'bash', cmdArgs: [filePath, ...args] };
            case 'typescript':
                return { command: 'npx', cmdArgs: ['ts-node', filePath, ...args] };
            case 'go':
                return { command: 'go', cmdArgs: ['run', filePath, ...args] };
            case 'rust':
                return { command: 'rustc', cmdArgs: ['-o', '/tmp/rust_bin', filePath, '&&', '/tmp/rust_bin', ...args] };
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }

    #execute(command, cmdArgs, options) {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let killed = false;

            // Restricted environment
            const sandboxEnv = {
                ...process.env,
                HOME: this.dir,
                TMPDIR: this.dir,
                PATH: '/usr/local/bin:/usr/bin:/bin',
                ...options.env,
                // Security: Remove sensitive vars
                AWS_ACCESS_KEY_ID: '',
                AWS_SECRET_ACCESS_KEY: '',
                API_KEY: '',
                SECRET: '',
            };

            this.process = spawn(command, cmdArgs, {
                cwd: options.cwd,
                env: sandboxEnv,
                stdio: ['pipe', 'pipe', 'pipe'],
                // Security: Resource limits would be set via cgroups in production
            });

            const timeout = setTimeout(() => {
                killed = true;
                this.process.kill('SIGKILL');
                reject(new Error(`Execution timeout (${this.options.timeout}ms)`));
            }, options.timeout || this.options.timeout);

            this.process.stdout.on('data', (data) => {
                stdout += data.toString();
                if (stdout.length > this.options.maxOutput) {
                    killed = true;
                    this.process.kill('SIGKILL');
                    reject(new Error('Output exceeded limit'));
                }
            });

            this.process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            this.process.on('close', (code) => {
                clearTimeout(timeout);
                
                if (killed) return; // Already handled
                
                resolve({
                    exitCode: code,
                    stdout: stdout.substring(0, this.options.maxOutput),
                    stderr: stderr.substring(0, this.options.maxOutput),
                    duration: Date.now() - this.started,
                    memory: 0, // Would track in production with cgroups
                });
            });

            this.process.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    cleanup() {
        if (this.process) {
            this.process.kill('SIGKILL');
        }
        try {
            if (fs.existsSync(this.dir)) {
                fs.rmSync(this.dir, { recursive: true, force: true });
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// 2026: Code execution with AI understanding
export class AISandbox extends CodeSandbox {
    constructor(options = {}) {
        super(options);
    }

    // Execute and analyze with AI
    async executeWithAnalysis(code, language, aiService) {
        // Run code
        const result = await this.execute(code, language);
        
        // Analyze output if AI service provided
        if (aiService && (result.stderr || result.exitCode !== 0)) {
            const analysis = await aiService.getChat(`
                Analyze this code execution result:
                
                Exit Code: ${result.exitCode}
                Stdout: ${result.stdout.substring(0, 500)}
                Stderr: ${result.stderr.substring(0, 500)}
                Duration: ${result.duration}ms
                
                What went wrong and how can it be fixed?
            `);
            
            result.analysis = analysis;
        }
        
        return result;
    }
}

// Factory
export function createSandbox(options = {}) {
    return new CodeSandbox(options);
}

export default CodeSandbox;
