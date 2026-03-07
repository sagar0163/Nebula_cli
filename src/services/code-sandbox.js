// 2026 Code Sandbox - Simplified for CLI use
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CodeSandbox {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.maxOutput = options.maxOutput || 1024 * 1024;
        this.sandboxDir = options.sandboxDir || path.join(os.tmpdir(), 'nebula-sandbox');
        
        // Essential languages only
        this.allowedLanguages = options.languages || [
            'javascript', 'typescript', 'python', 'bash', 'go', 'rust'
        ];
        
        this.languageConfig = {
            javascript: { ext: 'js', run: ['node'], args: (f) => [f] },
            typescript: { ext: 'ts', run: ['npx', 'ts-node'], args: (f) => [f] },
            python: { ext: 'py', run: ['python3'], args: (f) => [f] },
            bash: { ext: 'sh', run: ['bash'], args: (f) => [f] },
            go: { ext: 'go', run: ['go', 'run'], args: (f) => [f] },
            rust: { ext: 'rs', run: ['rustc'], args: (f) => [f, '-o', '/tmp/rust_bin', '&&', '/tmp/rust_bin'] },
        };
        
        // Basic security
        this.blockedPatterns = [
            /rm\s+-rf\s+\//,
            /fork\(\)/,
            /curl.*\|.*bash/,
            /wget.*\|.*bash/,
        ];
        
        this.#ensureSandboxDir();
    }

    #ensureSandboxDir() {
        if (!fs.existsSync(this.sandboxDir)) {
            fs.mkdirSync(this.sandboxDir, { recursive: true });
        }
    }

    async execute(code, language, options = {}) {
        const session = this.createSession();
        
        try {
            return await session.run(code, language, options);
        } finally {
            session.cleanup();
        }
    }

    createSession() {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const sessionDir = path.join(this.sandboxDir, sessionId);
        fs.mkdirSync(sessionDir, { recursive: true });
        return new SandboxSession(sessionId, sessionDir, this);
    }

    isSupported(language) {
        return this.allowedLanguages.includes(language.toLowerCase());
    }

    cleanup() {
        if (fs.existsSync(this.sandboxDir)) {
            fs.rmSync(this.sandboxDir, { recursive: true, force: true });
            this.#ensureSandboxDir();
        }
    }
}

class SandboxSession {
    constructor(id, dir, sandbox) {
        this.id = id;
        this.dir = dir;
        this.sandbox = sandbox;
        this.process = null;
    }

    async run(code, language, options = {}) {
        const lang = language.toLowerCase();
        const config = this.sandbox.languageConfig[lang];
        
        if (!config) {
            throw new Error(`Language not supported: ${language}`);
        }

        // Security check
        for (const pattern of this.sandbox.blockedPatterns) {
            if (pattern.test(code)) {
                throw new Error('Security violation detected');
            }
        }

        const filePath = path.join(this.dir, `main.${config.ext}`);
        fs.writeFileSync(filePath, code);

        return this.#execute(config.run[0], [...config.run.slice(1), ...config.args(filePath)], options.timeout || this.sandbox.timeout);
    }

    #execute(command, args, timeout) {
        return new Promise((resolve, reject) => {
            let stdout = '', stderr = '';
            const startTime = Date.now();

            const env = {
                ...process.env,
                HOME: this.dir,
                PATH: '/usr/local/bin:/usr/bin:/bin',
            };

            this.process = spawn(command, args, {
                cwd: this.dir,
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true,
            });

            const timer = setTimeout(() => {
                this.process.kill('SIGKILL');
                reject(new Error(`Timeout after ${timeout}ms`));
            }, timeout);

            this.process.stdout.on('data', d => stdout += d);
            this.process.stderr.on('data', d => stderr += d);

            this.process.on('close', code => {
                clearTimeout(timer);
                resolve({
                    exitCode: code,
                    stdout: stdout.substring(0, this.sandbox.maxOutput),
                    stderr: stderr.substring(0, this.sandbox.maxOutput),
                    duration: Date.now() - startTime,
                });
            });

            this.process.on('error', err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    cleanup() {
        if (this.process) this.process.kill('SIGKILL');
        try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch {}
    }
}

export function createSandbox(options) {
    return new CodeSandbox(options);
}

export default CodeSandbox;
