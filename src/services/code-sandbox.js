// 2026 Secure Code Execution Sandbox - Full Isolation + Monitoring
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec, execSync } from 'child_process';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// Resource Monitor
export class ResourceMonitor extends EventEmitter {
    constructor(interval = 1000) {
        super();
        this.interval = interval;
        this.metrics = new Map();
        this.monitoring = false;
        this.intervalId = null;
    }

    start(pid) {
        this.monitoring = true;
        this.metrics.set(pid, {
            startTime: Date.now(),
            cpuSamples: [],
            memorySamples: [],
        });

        this.intervalId = setInterval(() => this.#collect(pid), this.interval);
    }

    stop(pid) {
        this.monitoring = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        const data = this.metrics.get(pid);
        this.metrics.delete(pid);
        return data;
    }

    #collect(pid) {
        if (!this.monitoring) return;

        try {
            // Get CPU and memory via ps
            const { stdout } = execSync(`ps -p ${pid} -o %cpu,rss --no-headers`, { stdio: 'pipe' });
            const [cpu, rss] = stdout.trim().split(/\s+/).map(Number);
            
            const metric = this.metrics.get(pid);
            if (metric) {
                metric.cpuSamples.push({ time: Date.now(), cpu });
                metric.memorySamples.push({ time: Date.now(), memory: rss * 1024 }); // Convert to bytes
                
                // Emit live metrics
                this.emit('metrics', { pid, cpu, memory: rss * 1024 });
            }
        } catch {
            // Process might have ended
        }
    }

    getMetrics(pid) {
        return this.metrics.get(pid);
    }
}

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
        this.networkMode = options.networkMode || 'none';
        
        // CPU/Rate limits
        this.maxCPUs = options.maxCPUs || 2;
        this.maxProcesses = options.maxProcesses || 100;
        
        // File system sandboxing
        this.readOnlyRoot = options.readOnlyRoot !== undefined ? options.readOnlyRoot : true;
        this.allowedPaths = options.allowedPaths || [];
        this.deniedPaths = options.deniedPaths || ['/etc', '/root', '/home/.ssh', '/var/log'];
        
        // Resource monitoring
        this.monitorResources = options.monitorResources !== undefined ? options.monitorResources : true;
        this.resourceMonitor = new ResourceMonitor(options.monitorInterval || 1000);
        
        // Language-specific timeouts
        this.languageTimeouts = options.languageTimeouts || {
            javascript: 30000,
            typescript: 45000,
            python: 30000,
            python3: 30000,
            go: 45000,
            rust: 60000,
            java: 60000,
            kotlin: 60000,
            c: 30000,
            cpp: 30000,
            bash: 20000,
            sh: 20000,
            default: 30000,
        };
        
        // Allowed languages
        this.allowedLanguages = options.languages || [
            'javascript', 'typescript', 'python', 'python3', 'bash', 'sh',
            'go', 'rust', 'ruby', 'php', 'perl', 'lua', 'r', 'julia',
            'csharp', 'java', 'kotlin', 'scala', 'swift', 'c', 'cpp',
            'cxx', 'objc', 'dart', 'elixir', 'erlang', 'haskell', 'clojure',
            'fsharp', 'ocaml', 'powershell', 'sql', 'html', 'css', 'json', 'yaml'
        ];
        
        this.languageConfig = this.#initLanguageConfig();
        
        // Security patterns
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
            javascript: { ext: 'js', run: ['node'], args: (f) => [f], timeout: this.languageTimeouts.javascript },
            typescript: { ext: 'ts', run: ['npx', 'ts-node'], args: (f) => [f], timeout: this.languageTimeouts.typescript },
            python: { ext: 'py', run: ['python3'], args: (f) => [f], timeout: this.languageTimeouts.python },
            python2: { ext: 'py', run: ['python2'], args: (f) => [f], timeout: this.languageTimeouts.python2 },
            bash: { ext: 'sh', run: ['bash'], args: (f) => [f], timeout: this.languageTimeouts.bash },
            sh: { ext: 'sh', run: ['sh'], args: (f) => [f], timeout: this.languageTimeouts.sh },
            go: { ext: 'go', run: ['go', 'run'], args: (f) => [f], timeout: this.languageTimeouts.go },
            rust: { ext: 'rs', run: ['rustc'], args: (f) => [f, '-o', '/tmp/rust_bin', '&&', '/tmp/rust_bin'], timeout: this.languageTimeouts.rust },
            ruby: { ext: 'rb', run: ['ruby'], args: (f) => [f] },
            php: { ext: 'php', run: ['php'], args: (f) => [f] },
            perl: { ext: 'pl', run: ['perl'], args: (f) => [f] },
            lua: { ext: 'lua', run: ['lua'], args: (f) => [f] },
            r: { ext: 'R', run: ['Rscript'], args: (f) => [f] },
            julia: { ext: 'jl', run: ['julia'], args: (f) => [f] },
            csharp: { ext: 'cs', run: ['dotnet', 'script', 'run'], args: (f) => [f] },
            java: { ext: 'java', run: ['java'], args: (f) => [f], timeout: this.languageTimeouts.java, compile: true },
            kotlin: { ext: 'kt', run: ['kotlinc'], args: (f) => [f, '-include-runtime', '-d', '/tmp/app.jar', '&&', 'java', '-jar', '/tmp/app.jar'], timeout: this.languageTimeouts.kotlin },
            scala: { ext: 'scala', run: ['scala'], args: (f) => [f] },
            swift: { ext: 'swift', run: ['swift'], args: (f) => [f] },
            c: { ext: 'c', run: ['gcc'], args: (f) => [f, '-o', '/tmp/c_bin', '&&', '/tmp/c_bin'], timeout: this.languageTimeouts.c },
            cpp: { ext: 'cpp', run: ['g++'], args: (f) => [f, '-o', '/tmp/cpp_bin', '&&', '/tmp/cpp_bin'], timeout: this.languageTimeouts.cpp },
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

    createSession(options = {}) {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const sessionDir = path.join(this.sandboxDir, sessionId);
        
        fs.mkdirSync(sessionDir, { recursive: true });
        
        return new SandboxSession(sessionId, sessionDir, {
            ...this.#getOptions(),
            ...options,
            resourceMonitor: this.resourceMonitor,
            monitorResources: this.monitorResources,
            languageTimeouts: this.languageTimeouts,
        });
    }

    #getOptions() {
        return {
            timeout: this.timeout,
            maxMemory: this.maxMemory,
            maxOutput: this.maxOutput,
            maxFileSize: this.maxFileSize,
            useDocker: this.useDocker,
            dockerImage: this.dockerImage,
            networkEnabled: this.networkEnabled,
            networkMode: this.networkMode,
            maxCPUs: this.maxCPUs,
            maxProcesses: this.maxProcesses,
            readOnlyRoot: this.readOnlyRoot,
            allowedPaths: this.allowedPaths,
            deniedPaths: this.deniedPaths,
            allowedLanguages: this.allowedLanguages,
            languageConfig: this.languageConfig,
            blockedPatterns: this.blockedPatterns,
        };
    }

    async execute(code, language, options = {}) {
        const session = this.createSession();
        
        try {
            const result = await session.run(code, language, options);
            return result;
        } finally {
            session.cleanup();
        }
    }

    async executeProject(files, entryPoint, options = {}) {
        const session = this.createSession();
        
        try {
            for (const file of files) {
                const filePath = path.join(session.dir, file.path);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(filePath, file.content);
            }
            
            const result = await session.runProject(entryPoint, options);
            return result;
        } finally {
            session.cleanup();
        }
    }

    // Update language timeout
    setLanguageTimeout(language, timeout) {
        this.languageTimeouts[language.toLowerCase()] = timeout;
        // Update config
        if (this.languageConfig[language.toLowerCase()]) {
            this.languageConfig[language.toLowerCase()].timeout = timeout;
        }
    }

    // Get timeout for language
    getLanguageTimeout(language) {
        return this.languageTimeouts[language.toLowerCase()] || this.languageTimeouts.default;
    }

    getSupportedLanguages() {
        return Object.keys(this.languageConfig);
    }

    isSupported(language) {
        return this.allowedLanguages.includes(language.toLowerCase());
    }

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

// Individual sandbox session with full isolation
class SandboxSession {
    constructor(id, dir, options) {
        this.id = id;
        this.dir = dir;
        this.options = options;
        this.process = null;
        this.started = null;
        this.dockerContainer = null;
        this.resourceMonitor = options.resourceMonitor;
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

        // Get language-specific timeout or use default
        const timeout = options.timeout || config.timeout || this.options.languageTimeouts.default || this.options.timeout;

        const fileName = `main.${config.ext}`;
        const filePath = path.join(this.dir, fileName);
        
        if (code.length > this.options.maxFileSize) {
            throw new Error(`Code exceeds maximum size of ${this.options.maxFileSize} bytes`);
        }
        
        fs.writeFileSync(filePath, code);

        if (this.options.useDocker) {
            return this.#runInDocker(config, filePath, args, { ...options, timeout });
        }

        return this.#runLocally(config, filePath, args, { cwd, env, timeout });
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
        
        const timeout = options.timeout || config.timeout || this.options.timeout;

        if (this.options.useDocker) {
            return this.#runInDocker(config, filePath, args, { ...options, timeout });
        }

        return this.#runLocally(config, filePath, args, { cwd: this.dir, env, timeout });
    }

    #extToLanguage(ext) {
        const map = {
            js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash',
            go: 'go', rs: 'rust', rb: 'ruby', php: 'php', pl: 'perl',
            lua: 'lua', r: 'r', jl: 'julia', cs: 'csharp',
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
        
        // Check for path traversal attempts
        const dangerousPaths = ['/etc/passwd', '/etc/shadow', '/root/.ssh', '/var/log'];
        for (const p of dangerousPaths) {
            if (code.includes(p)) {
                throw new Error(`Security violation: access to ${p} denied`);
            }
        }
    }

    #runInDocker(config, filePath, args, options) {
        const containerName = `nebula-sandbox-${this.id}`;
        
        const dockerArgs = [
            'run', '--rm',
            '--name', containerName,
            '--memory', `${this.options.maxMemory}m`,
            '--cpus', this.options.maxCPUs.toString(),
            '--pids-limit', this.options.maxProcesses.toString(),
            '-v', `${this.dir}:/workspace`,
            '-w', '/workspace',
        ];

        // Read-only root filesystem
        if (this.options.readOnlyRoot) {
            dockerArgs.push('--read-only=true');
        }

        // Allow specific paths if configured
        for (const p of this.options.allowedPaths) {
            dockerArgs.push('-v', `${p}:${p}:ro`);
        }

        // Network isolation
        if (!this.options.networkEnabled) {
            dockerArgs.push('--network', 'none');
        } else if (this.options.networkMode) {
            dockerArgs.push('--network', this.options.networkMode);
        }

        dockerArgs.push(
            '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges',
            '-e', 'HOME=/workspace',
            '--tmpfs', '/tmp:rw,noexec,size=100m',
        );

        const image = this.options.dockerImage;
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
                AWS_ACCESS_KEY_ID: '',
                AWS_SECRET_ACCESS_KEY: '',
                API_KEY: '',
                SECRET: '',
                PASSWORD: '',
                TOKEN: '',
            };

            this.process = spawn(command, cmdArgs, {
                cwd: options.cwd || this.dir,
                env: sandboxEnv,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true,
            });

            // Start resource monitoring
            if (this.options.monitorResources && this.resourceMonitor) {
                this.resourceMonitor.start(this.process.pid);
            }

            const timeout = setTimeout(() => {
                killed = true;
                this.process.kill('SIGKILL');
                reject(new Error(`Execution timeout (${options.timeout}ms)`));
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
                // Stop resource monitoring
                let metrics = null;
                if (this.resourceMonitor && this.process) {
                    metrics = this.resourceMonitor.stop(this.process.pid);
                }

                clearTimeout(timeout);
                if (killed) return;
                
                resolve({
                    exitCode: code,
                    stdout: stdout.substring(0, this.options.maxOutput),
                    stderr: stderr.substring(0, this.options.maxOutput),
                    duration: Date.now() - this.started,
                    metrics: metrics ? {
                        avgCpu: metrics.cpuSamples.reduce((a, b) => a + b.cpu, 0) / metrics.cpuSamples.length,
                        maxMemory: Math.max(...metrics.memorySamples),
                        samples: metrics.cpuSamples.length,
                    } : null,
                });
            });

            this.process.on('error', (err) => {
                if (this.resourceMonitor && this.process) {
                    this.resourceMonitor.stop(this.process.pid);
                }
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    cleanup() {
        if (this.process) {
            this.process.kill('SIGKILL');
        }
        
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
                Metrics: ${JSON.stringify(result.metrics)}
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
