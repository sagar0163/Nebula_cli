// 2026 Code Sandbox - Minimal for CLI
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

export class CodeSandbox {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.maxOutput = options.maxOutput || 1024 * 1024;
        this.sandboxDir = options.sandboxDir || os.tmpdir();
        
        // Only essential languages
        this.languages = {
            javascript: { ext: 'js', cmd: ['node'] },
            typescript: { ext: 'ts', cmd: ['npx', 'ts-node'] },
            python: { ext: 'py', cmd: ['python3'] },
            bash: { ext: 'sh', cmd: ['bash'] },
            go: { ext: 'go', cmd: ['go', 'run'] },
        };
    }

    async execute(code, language, options = {}) {
        const lang = this.languages[language.toLowerCase()];
        if (!lang) throw new Error(`Unsupported: ${language}`);

        // Security check
        if (/rm\s+-rf|curl.*\|.*bash|wget.*\|.*bash/.test(code)) {
            throw new Error('Security violation');
        }

        const id = crypto.randomBytes(4).toString('hex');
        const file = path.join(this.sandboxDir, `nebula_${id}.${lang.ext}`);
        
        try {
            fs.writeFileSync(file, code);
            return await this.#run(lang.cmd[0], [...lang.cmd.slice(1), file], options.timeout || this.timeout);
        } finally {
            try { fs.unlinkSync(file); } catch {}
        }
    }

    #run(cmd, args, timeout) {
        return new Promise((resolve, reject) => {
            let out = '', err = '';
            const start = Date.now();
            const proc = spawn(cmd, args, { 
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, HOME: process.env.HOME }
            });

            proc.stdout.on('data', d => out += d);
            proc.stderr.on('data', d => err += d);
            
            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error(`Timeout ${timeout}ms`));
            }, timeout);

            proc.on('close', code => {
                clearTimeout(timer);
                resolve({ exitCode: code, stdout: out, stderr: err, duration: Date.now() - start });
            });
            proc.on('error', e => { clearTimeout(timer); reject(e); });
        });
    }

    isSupported(lang) {
        return !!this.languages[lang.toLowerCase()];
    }
}

export function createSandbox(o) { return new CodeSandbox(o); }
export default CodeSandbox;
