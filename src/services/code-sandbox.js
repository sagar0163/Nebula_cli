// 2026 Code Sandbox - Minimal for CLI, with Docker isolation support
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

let DOCKER_AVAILABLE = null;

export function isDockerAvailable() {
    if (DOCKER_AVAILABLE !== null) return DOCKER_AVAILABLE;
    try {
        execSync('docker info', { stdio: 'ignore', timeout: 5000 });
        DOCKER_AVAILABLE = true;
    } catch (_e) {
        DOCKER_AVAILABLE = false;
    }
    return DOCKER_AVAILABLE;
}

export class CodeSandbox {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.maxOutput = options.maxOutput || 1024 * 1024;
        this.sandboxDir = options.sandboxDir || os.tmpdir();
        this.useDocker = options.useDocker !== undefined ? options.useDocker : isDockerAvailable();
        this.dockerImage = options.dockerImage || 'node:20-alpine';
        this.network = options.network || 'none';
        this.cpus = options.cpus || '0.5';
        this.memory = options.memory || '256m';
        this.volumes = options.volumes || [];

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
            if (options.useDocker !== undefined ? options.useDocker : this.useDocker) {
                return await this.#runDocker(file, lang, options);
            }
            return await this.#run(lang.cmd[0], [...lang.cmd.slice(1), file], options.timeout || this.timeout);
        } finally {
            try { fs.unlinkSync(file); } catch { /* Ignore cleanup errors */ }
        }
    }

    #runDocker(file, lang, options) {
        return new Promise((resolve, reject) => {
            let out = '', err = '';
            const start = Date.now();
            const fileDir = path.dirname(file);
            const fileName = path.basename(file);
            const timeout = options.timeout || this.timeout;
            const network = options.network || this.network;

            const args = ['run', '--rm', '-i'];
            args.push('--network', network);
            args.push(`--cpus=${options.cpus || this.cpus}`);
            args.push(`--memory=${options.memory || this.memory}`);
            args.push('-v', `${fileDir}:/work:ro`);
            args.push('-w', '/work');
            if (this.volumes && this.volumes.length) {
                for (const v of this.volumes) args.push('-v', v);
            }
            if (options.env) {
                for (const k of Object.keys(options.env)) {
                    args.push('-e', `${k}=${options.env[k]}`);
                }
            }
            args.push(this.dockerImage);
            args.push(...lang.cmd.slice(0, -1));
            args.push(lang.cmd[lang.cmd.length - 1], `/work/${fileName}`);
            if (lang.cmd.length > 1 && lang.cmd[lang.cmd.length - 1] === file) {
                // ts-node / go run style: interpreter must take script path as arg
                args.pop();
                args.pop();
                args.push(lang.cmd[lang.cmd.length - 1], `/work/${fileName}`);
            }

            const proc = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });

            proc.stdout.on('data', (d) => {
                out += d;
                if (out.length > this.maxOutput) {
                    proc.kill();
                }
            });
            proc.stderr.on('data', (d) => {
                err += d;
                if (err.length > this.maxOutput) {
                    proc.kill();
                }
            });

            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error(`Timeout ${timeout}ms`));
            }, timeout);

            proc.on('close', (code) => {
                clearTimeout(timer);
                resolve({ exitCode: code, stdout: out, stderr: err, duration: Date.now() - start, sandbox: 'docker' });
            });
            proc.on('error', (e) => {
                clearTimeout(timer);
                reject(e);
            });
        });
    }

    #run(cmd, args, timeout) {
        return new Promise((resolve, reject) => {
            let out = '', err = '';
            const start = Date.now();
            const proc = spawn(cmd, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, HOME: process.env.HOME }
            });

            proc.stdout.on('data', (d) => {
                out += d;
                if (out.length > this.maxOutput) proc.kill();
            });
            proc.stderr.on('data', (d) => {
                err += d;
                if (err.length > this.maxOutput) proc.kill();
            });

            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error(`Timeout ${timeout}ms`));
            }, timeout);

            proc.on('close', (code) => {
                clearTimeout(timer);
                resolve({ exitCode: code, stdout: out, stderr: err, duration: Date.now() - start, sandbox: 'local' });
            });
            proc.on('error', (e) => { clearTimeout(timer); reject(e); });
        });
    }

    isSupported(lang) {
        return !!this.languages[lang.toLowerCase()];
    }
}

export function createSandbox(o) { return new CodeSandbox(o); }
export default CodeSandbox;