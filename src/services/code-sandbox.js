// 2026 Secure Code Execution Sandbox - Docker + Network Isolation
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec, execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

export class CodeSandbox {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.maxMemory = options.maxMemory || 512;
        this.maxOutput = options.maxOutput || 1024 * 1024;
        this.sandboxDir = options.sandboxDir || path.join(os.tmpdir(), 'nebula-sandbox');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
        
        // Docker + Network options
        this.useDocker = options.useDocker || false;
        this.dockerImage = options.dockerImage || 'nebula-sandbox:latest';
        this.networkEnabled = options.networkEnabled !== undefined ? options.networkEnabled : false;
        this.networkMode = options.networkMode || 'none'; // 'none', 'bridge', 'host'
        this.mounts = options.mounts || [];
        
        // CPU/Rate limits
        this.maxCPUs = options.maxCPUs || 2;
        this.maxProcesses = options.maxProcesses || 100;
        
        // Allowed languages
        this.allowedLanguages = options.languages || [
            'javascript', 'typescript', 'python', 'python3', 'bash', 'sh',
            'go', 'rust', 'ruby', 'php', 'perl', 'lua', 'r', 'julia',
            'csharp', 'java', 'kotlin', 'scala', 'swift', 'c', 'cpp',
            'cxx', 'objc', 'dart', 'elixir', 'erlang', 'haskell', 'clojure',
            'fsharp', 'ocaml', 'powershell', 'sql', 'html', 'css', 'json', 'yaml'
        ];
        
        this.languageConfig = this.#initLanguageConfig();
        
        // Security: Blocked patterns
        this.blockedPatterns = [
            /rm\s+-rf\s+\//,
            /fork\(\)/,
            /while\s*\(\s*true\s*\)/,
            /:\(\)\{.*:\|\:&\}/,
            /exec.*\/etc\/passwd/,
            /curl.*\|.*bash/,
            /wget.*\|.*bash/,
            /chmod\s+777/,
            /chown\s+root/,
            /:\(){.*:&}/,
        ];
        
        this.#ensureSandboxDir();
    }

    #ensureSandboxDir() {
        if (!fs.existsSync(this.sandboxDir)) {
            fs.mkdirSync(this.sandboxDir, { recursive: true });
        }
    }

    #initLanguageConfig() {
        return {
            javascript: { ext: 'js', run: ['node'], args: (f) => [f] },
            typescript: { ext: 'ts', run: ['npx', 'ts-node'], args: (f) => [f] },
            python: { ext: 'py', run: ['python3'], args: (f) => [f] },
            python2: { ext: 'py', run: ['python2'], args: (f) => [f] },
            bash: { ext: 'sh', run: ['bash'], args: (f) => [f] },
            sh: { ext: 'sh', run: ['sh'], args: (f) => [f] },
            go: { ext: 'go', run: ['go', 'run'], args: (f) => [f] },
            rust: { ext: 'rs', run: ['rustc'], args: (f) => [f, '-o', '/tmp/rust_bin', '&&', '/tmp/rust_bin'] },
            ruby: { ext: 'rb', run: ['ruby'], args: (f) => [f] },
            php: { ext: 'php', run: ['php'], args: (f) => [f] },
            perl: { ext: 'pl', run: ['perl'], args: (f) => [f] },
            lua: { ext: 'lua', run: ['lua'], args: (f) => [f] },
            r: { ext: 'R', run: ['Rscript'], args: (f) => [f] },
            julia: { ext: 'jl', run: ['julia'], args: (f) => [f] },
            csharp: { ext: 'cs', run: ['dotnet', 'script', 'run'], args: (f) => [f] },
            java: { ext: 'java', run: ['java'], args: (f) => [f], compile: true },
            kotlin: { ext: 'kt', run: ['kotlinc'], args: (f) => [f, '-include-runtime', '-d', '/tmp/app.jar', '&&', 'java', '-jar', '/tmp/app.jar'] },
            scala: { ext: 'scala', run: ['scala'], args: (f) => [f] },
            swift: { ext: 'swift', run: ['swift'], args: (f) => [f] },
            c: { ext: 'c', run: ['gcc'], args: (f) => [f, '-o', '/tmp/c_bin', '&&', '/tmp/c_bin'] },
            cpp: { ext: 'cpp', run: ['g++'], args: (f) => [f, '-o', '/tmp/cpp_bin', '&&', '/tmp/cpp_bin'] },
            cxx: { ext: 'cxx', run: ['g++'], args: (f) => [f, '-o', '/tmp/cxx_bin', '&&', '/tmp/cxx_bin'] },
            objc: { ext: 'm', run: ['clang'], args: (f) => [f, '-o', '/tmp/objc_bin', '&&', '/tmp/objc_bin'] },
            dart: { ext: 'dart', run: ['dart'], args: (f) => [f] },
            elixir: { ext: 'ex', run: ['elixir'], args: (f) => [f] },
            erlang: { ext: 'erl', run: ['escript'], args: (f) => [f] },
            haskell: { ext: 'hs', run: ['runhaskell'], args: (f) => [f] },
            clojure: { ext: 'clj', run: ['clojure'], args: (f) => [f] },
            fsharp: { ext: 'fs', run: ['dotnet', 'fsi'], args: (f) => [f] },
            ocaml: { ext: 'ml', run: ['ocaml'], args: (f) => [f] },
            powershell: { ext: 'ps1', run: ['pwsh', '-File'], args: (f) => [f] },
            sql: { ext: 'sql', run: ['sqlite3', ':memory:'], args: (f) => ['<', f] },
            html: { ext: 'html', run: [], args: () => [], serve: true },
            css: { ext: 'css', run: [], args: () => [], serve: true },
            json: { ext: 'json', run: ['node', '-e'], args: (f) => [`console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('${f}'))))`] },
            yaml: { ext: 'yaml', run: ['node', '-e'], args: (f) => [`console.log(require('js-yaml').load(require('fs').readFileSync('${f}')))`] },
        };
    }

    // Create session (supports multi-file)
    createSession(options = {}) {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const sessionDir = path.join(this.sandboxDir, sessionId);
        
        fs.mkdirSync(sessionDir, { recursive: true });
        
        return new SandboxSession(sessionId, sessionDir, {
            ...this.options,
            ...options,
            useDocker: this.useDocker,
            dockerImage: this.dockerImage,
            networkEnabled: this.networkEnabled,
            networkMode: this.networkMode,
            maxCPUs: this.maxCPUs,
            maxProcesses: this.maxProcesses,
            allowedLanguages: this.allowedLanguages,
            languageConfig: this.languageConfig,
            blockedPatterns: this.blockedPatterns,
        });
    }

    // Execute single file
    async execute(code, language, options = {}) {
        const session = this.createSession();
        
        try {
            const result = await session.run(code, language, options);
            return result;
        } finally {
            session.cleanup();
        }
    }

    // Execute multi-file project
    async executeProject(files, entryPoint, options = {}) {
        const session = this.createSession();
        
        try {
            // Write all files
            for (const file of files) {
                const filePath = path.join(session.dir, file.path);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(filePath, file.content);
            }
            
            // Run entry point
            const result = await session.runProject(entryPoint, options);
            return result;
        } finally {
            session.cleanup();
        }
    }

    getSupportedLanguages() {
        return Object.keys(this.languageConfig);
    }

    isSupported(language) {
        return this.allowedLanguages.includes(language.toLowerCase());
    }

    // Check Docker availability
    async checkDocker() {
        try {
            execSync('docker --version', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    cleanup() {
        if (fs.existsSync(this.sandboxDir)) {
            fs.rmSync(this.sandboxDir, { recursive: true, force: true });
            this.#ensureSandboxDir();
        }
    }
}

// Individual sandbox session with Docker + Network isolation
class SandboxSession {
    constructor(id, dir, options) {
        this.id = id;
        this.dir = dir;
        this.options = options;
        this.process = null;
        this.started = null;
        this.dockerContainer = null;
    }

    async run(code, language, options = {}) {
        const { args = [], env = {}, cwd = this.dir } = options;
        
        this.started = Date.now();
        
        const langLower = language.toLowerCase();
        if (!this.options.allowedLanguages.includes(langLower)) {
            throw new Error(`Language not allowed: ${language}`);
        }

        this.#checkSecurity(code);

        const config = this.options.languageConfig[langLower];
        if (!config) {
            throw new Error(`No configuration for language: ${language}`);
        }

        const fileName = `main.${config.ext}`;
        const filePath = path.join(this.dir, fileName);
        
        if (code.length > this.options.maxFileSize) {
            throw new Error(`Code exceeds maximum size of ${this.options.maxFileSize} bytes`);
        }
        
        fs.writeFileSync(filePath, code);

        // Use Docker if enabled
        if (this.options.useDocker) {
            return this.#runInDocker(config, filePath, args, options);
        }

        return this.#runLocally(config, filePath, args, { cwd, env, timeout: options.timeout });
    }

    async runProject(entryPoint, options = {}) {
        const { args = [], env = {} } = options;
        
        this.started = Date.now();
        
        const ext = path.extname(entryPoint).slice(1);
        const language = this.#extToLanguage(ext);
        
        if (!this.options.allowedLanguages.includes(language)) {
            throw new Error(`Language not supported: ${language}`);
        }

        const config = this.options.languageConfig[language];
        const filePath = path.join(this.dir, entryPoint);

        if (this.options.useDocker) {
            return this.#runInDocker(config, filePath, args, options);
        }

        return this.#runLocally(config, filePath, args, { cwd: this.dir, env, timeout: options.timeout });
    }

    #extToLanguage(ext) {
        const map = {
            js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash',
            go: 'go', rs: 'rust', rb: 'ruby', php: 'php', pl: 'perl',
            lua: 'lua', r: 'r', R: 'r', jl: 'julia', cs: 'csharp',
            java: 'java', kt: 'kotlin', scala: 'scala', swift: 'swift',
            c: 'c', cpp: 'cpp', cxx: 'cxx', m: 'objc', dart: 'dart',
            ex: 'elixir', erl: 'erlang', hs: 'haskell', clj: 'clojure',
            fs: 'fsharp', ml: 'ocaml', ps1: 'powershell', sql: 'sql',
            html: 'html', css: 'css', json: 'json', yaml: 'yaml', yml: 'yaml',
        };
        return map[ext] || ext;
    }

    #checkSecurity(code) {
        for (const pattern of this.options.blockedPatterns) {
            if (pattern.test(code)) {
                throw new Error(`Security violation: blocked pattern detected`);
            }
        }
    }

    // Docker execution with network isolation
    async #runInDocker(config, filePath, args, options) {
        const containerName = `nebula-sandbox-${this.id}`;
        
        // Build docker run command with restrictions
        const dockerArgs = [
            'run', '--rm',
            '--name', containerName,
            '--memory', `${this.options.maxMemory}m`,
            '--cpus', this.options.maxCPUs.toString(),
            '--pids-limit', this.options.maxProcesses.toString(),
            '-v', `${this.dir}:/workspace`,
            '-w', '/workspace',
        ];

        // Network isolation
        if (!this.options.networkEnabled) {
            dockerArgs.push('--network', 'none');
        } else if (this.options.networkMode) {
            dockerArgs.push('--network', this.options.networkMode);
        }

        // Additional security
        dockerArgs.push(
            '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges',
            '-e', 'HOME=/workspace',
        );

        // Use custom image or default
        const image = this.options.dockerImage;
        
        // Build command
        const cmd = config.run.join(' ');
        const finalArgs = [...dockerArgs, image, 'sh', '-c', `${cmd} ${config.args(filePath).join(' ')} ${args.join(' ')}`];
        
        return this.#execute('docker', finalArgs, { timeout: options.timeout });
    }

    #runLocally(config, filePath, args, options) {
        if (!config.run || config.run.length === 0) {
            return Promise.resolve({ exitCode: 0, stdout: '', stderr: '', duration: 0 });
        }

        const cmdArgs = [...config.run.slice(1), ...config.args(filePath), ...args];
        return this.#execute(config.run[0], cmdArgs, options);
    }

    #execute(command, cmdArgs, options) {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let killed = false;

            const sandboxEnv = {
                ...process.env,
                HOME: this.dir,
                TMPDIR: this.dir,
                TEMP: this.dir,
                TMP: this.dir,
                PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
                ...options.env,
                AWS_ACCESS_KEY_ID: '',
                AWS_SECRET_ACCESS_KEY: '';
                API_KEY: '';
                SECRET: '';
                PASSWORD: '';
                TOKEN: '';
            };

            this.process = spawn(command, cmdArgs, {
                cwd: options.cwd || this.dir,
                env: sandboxEnv,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true,
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
                if (killed) return;
                
                resolve({
                    exitCode: code,
                    stdout: stdout.substring(0, this.options.maxOutput),
                    stderr: stderr.substring(0, this.options.maxOutput),
                    duration: Date.now() - this.started,
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
        
        // Cleanup docker container if exists
        if (this.dockerContainer) {
            try {
                execSync(`docker rm -f ${this.dockerContainer}`, { stdio: 'ignore' });
            } catch {}
        }
        
        try {
            if (fs.existsSync(this.dir)) {
                fs.rmSync(this.dir, { recursive: true, force: true });
            }
        } catch {}
    }
}

// AI-enhanced sandbox
export class AISandbox extends CodeSandbox {
    constructor(options = {}) {
        super(options);
    }

    async executeWithAnalysis(code, language, aiService) {
        const result = await this.execute(code, language);
        
        if (aiService && (result.stderr || result.exitCode !== 0)) {
            const analysis = await aiService.getChat(`
                Analyze this code execution result:
                Exit Code: ${result.exitCode}
                Stdout: ${result.stdout.substring(0, 1000)}
                Stderr: ${result.stderr.substring(0, 1000)}
                Duration: ${result.duration}ms
                What went wrong and how can it be fixed?
            `);
            result.analysis = analysis;
        }
        
        return result;
    }
}

export function createSandbox(options = {}) {
    return new CodeSandbox(options);
}

export default CodeSandbox;
