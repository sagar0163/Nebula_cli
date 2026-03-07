// 2026 Secure Code Execution Sandbox - Extended Version
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

export class CodeSandbox {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.maxMemory = options.maxMemory || 512;
        this.maxOutput = options.maxOutput || 1024 * 1024;
        this.sandboxDir = options.sandboxDir || path.join(os.tmpdir(), 'nebula-sandbox');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        
        // Extended language support
        this.allowedLanguages = options.languages || [
            'javascript', 'typescript', 'python', 'python3', 'bash', 'sh',
            'go', 'rust', 'ruby', 'php', 'perl', 'lua', 'r', 'julia',
            'csharp', 'java', 'kotlin', 'scala', 'swift', 'c', 'cpp',
            'cxx', 'objc', 'dart', 'elixir', 'erlang', 'haskell', 'clojure',
            'fsharp', 'ocaml', 'powershell', 'dockerfile', 'sql', 'html',
            'css', 'json', 'yaml', 'toml', 'markdown'
        ];
        
        // Language configurations
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
            javascript: {
                ext: 'js', run: ['node'], args: (f) => [f],
                compile: false, mime: 'application/javascript'
            },
            typescript: {
                ext: 'ts', run: ['npx', 'ts-node'], args: (f) => [f],
                compile: false, mime: 'application/typescript'
            },
            python: {
                ext: 'py', run: ['python3', 'python'], args: (f) => [f],
                compile: false, mime: 'text/x-python'
            },
            python2: {
                ext: 'py', run: ['python2'], args: (f) => [f],
                compile: false, mime: 'text/x-python'
            },
            bash: {
                ext: 'sh', run: ['bash'], args: (f) => [f],
                compile: false, mime: 'application/x-sh'
            },
            sh: {
                ext: 'sh', run: ['sh'], args: (f) => [f],
                compile: false, mime: 'application/x-sh'
            },
            go: {
                ext: 'go', run: ['go', 'run'], args: (f) => [f],
                compile: false, mime: 'text/x-go'
            },
            rust: {
                ext: 'rs', run: ['rustc', '-o', '/tmp/rust_bin'], 
                args: (f) => [f, '&&', '/tmp/rust_bin'],
                compile: true, mime: 'text/x-rust'
            },
            ruby: {
                ext: 'rb', run: ['ruby'], args: (f) => [f],
                compile: false, mime: 'application/x-ruby'
            },
            php: {
                ext: 'php', run: ['php'], args: (f) => [f],
                compile: false, mime: 'text/x-php'
            },
            perl: {
                ext: 'pl', run: ['perl'], args: (f) => [f],
                compile: false, mime: 'text/x-perl'
            },
            lua: {
                ext: 'lua', run: ['lua'], args: (f) => [f],
                compile: false, mime: 'text/x-lua'
            },
            r: {
                ext: 'R', run: ['Rscript'], args: (f) => [f],
                compile: false, mime: 'text/x-r'
            },
            julia: {
                ext: 'jl', run: ['julia'], args: (f) => [f],
                compile: false, mime: 'text/x-julia'
            },
            csharp: {
                ext: 'cs', run: ['dotnet', 'script', 'run'], args: (f) => [f],
                compile: false, mime: 'text/x-csharp'
            },
            java: {
                ext: 'java', run: ['java'], args: (f) => [f],
                compile: true, compileCmd: 'javac', mime: 'text/x-java'
            },
            kotlin: {
                ext: 'kt', run: ['kotlinc', '-include-runtime', '-d'], args: (f) => ['/tmp/app.jar', f, '&&', 'java', '-jar', '/tmp/app.jar'],
                compile: true, mime: 'text/x-kotlin'
            },
            scala: {
                ext: 'scala', run: ['scala'], args: (f) => [f],
                compile: false, mime: 'text/x-scala'
            },
            swift: {
                ext: 'swift', run: ['swift'], args: (f) => [f],
                compile: false, mime: 'text/x-swift'
            },
            c: {
                ext: 'c', run: ['gcc', '-o', '/tmp/c_bin'], 
                args: (f) => [f, '-o', '/tmp/c_bin', '&&', '/tmp/c_bin'],
                compile: true, compileCmd: 'gcc', mime: 'text/x-c'
            },
            cpp: {
                ext: 'cpp', run: ['g++', '-o', '/tmp/cpp_bin'],
                args: (f) => [f, '-o', '/tmp/cpp_bin', '&&', '/tmp/cpp_bin'],
                compile: true, compileCmd: 'g++', mime: 'text/x-c++'
            },
            cxx: {
                ext: 'cxx', run: ['g++', '-o', '/tmp/cxx_bin'],
                args: (f) => [f, '-o', '/tmp/cxx_bin', '&&', '/tmp/cxx_bin'],
                compile: true, compileCmd: 'g++', mime: 'text/x-c++'
            },
            objc: {
                ext: 'm', run: ['clang', '-o', '/tmp/objc_bin'],
                args: (f) => [f, '-o', '/tmp/objc_bin', '&&', '/tmp/objc_bin'],
                compile: true, compileCmd: 'clang', mime: 'text/x-objc'
            },
            dart: {
                ext: 'dart', run: ['dart'], args: (f) => [f],
                compile: false, mime: 'text/x-dart'
            },
            elixir: {
                ext: 'ex', run: ['elixir'], args: (f) => [f],
                compile: false, mime: 'text/x-elixir'
            },
            erlang: {
                ext: 'erl', run: ['escript'], args: (f) => [f],
                compile: false, mime: 'text/x-erlang'
            },
            haskell: {
                ext: 'hs', run: ['runhaskell'], args: (f) => [f],
                compile: false, mime: 'text/x-haskell'
            },
            clojure: {
                ext: 'clj', run: ['clojure'], args: (f) => [f],
                compile: false, mime: 'text/x-clojure'
            },
            fsharp: {
                ext: 'fs', run: ['dotnet', 'fsi'], args: (f) => [f],
                compile: false, mime: 'text/x-fsharp'
            },
            ocaml: {
                ext: 'ml', run: ['ocaml'], args: (f) => [f],
                compile: false, mime: 'text/x-ocaml'
            },
            powershell: {
                ext: 'ps1', run: ['pwsh', '-File'], args: (f) => [f],
                compile: false, mime: 'text/x-powershell'
            },
            sql: {
                ext: 'sql', run: ['sqlite3', ':memory:'], args: (f) => ['<', f],
                compile: false, mime: 'text/x-sql'
            },
            dockerfile: {
                ext: 'Dockerfile', run: ['docker', 'build'], args: (f) => ['-f', f, '.'],
                compile: false, mime: 'text/x-dockerfile'
            },
            html: {
                ext: 'html', run: [], args: (f) => [],
                compile: false, mime: 'text/html', serve: true
            },
            css: {
                ext: 'css', run: [], args: (f) => [],
                compile: false, mime: 'text/css', serve: true
            },
            json: {
                ext: 'json', run: ['node', '-e'], 
                args: (f) => ['console.log(JSON.stringify(JSON.parse(require("fs").readFileSync("' + f + '"))))'],
                compile: false, mime: 'application/json'
            },
            yaml: {
                ext: 'yaml', run: ['node', '-e'],
                args: (f) => ['console.log(require("js-yaml").load(require("fs").readFileSync("' + f + '")))'],
                compile: false, mime: 'text/yaml'
            },
            toml: {
                ext: 'toml', run: ['node', '-e'],
                args: (f) => ['console.log(require("@iarna/toml").parse(require("fs").readFileSync("' + f + '")))'],
                compile: false, mime: 'text/toml'
            },
            markdown: {
                ext: 'md', run: ['npx', 'markdown'], args: (f) => [f],
                compile: false, mime: 'text/markdown'
            },
            // Web frameworks
            react: {
                ext: 'jsx', run: ['npx', 'vite'], args: (f) => ['build'],
                compile: false, framework: 'react'
            },
            vue: {
                ext: 'vue', run: ['npx', 'vite'], args: (f) => ['build'],
                compile: false, framework: 'vue'
            },
            svelte: {
                ext: 'svelte', run: ['npx', 'vite'], args: (f) => ['build'],
                compile: false, framework: 'svelte'
            },
            // Data science
            jupyter: {
                ext: 'ipynb', run: ['jupyter', 'nbconvert'], args: (f) => ['--to', 'notebook', '--execute', f],
                compile: false, mime: 'application/x-ipynb'
            },
            // Shell scripts
            zsh: {
                ext: 'zsh', run: ['zsh'], args: (f) => [f],
                compile: false, mime: 'application/x-zsh'
            },
            fish: {
                ext: 'fish', run: ['fish'], args: (f) => [f],
                compile: false, mime: 'application/x-fish'
            },
        };
    }

    createSession() {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const sessionDir = path.join(this.sandboxDir, sessionId);
        
        fs.mkdirSync(sessionDir, { recursive: true });
        
        return new SandboxSession(sessionId, sessionDir, {
            timeout: this.timeout,
            maxMemory: this.maxMemory,
            maxOutput: this.maxOutput,
            maxFileSize: this.maxFileSize,
            allowedLanguages: this.allowedLanguages,
            languageConfig: this.languageConfig,
            blockedPatterns: this.blockedPatterns,
        });
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

    // List available languages
    getSupportedLanguages() {
        return Object.keys(this.languageConfig);
    }

    // Check if language is available
    isSupported(language) {
        return this.allowedLanguages.includes(language.toLowerCase());
    }

    // Get language info
    getLanguageInfo(language) {
        return this.languageConfig[language.toLowerCase()];
    }

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
        const langLower = language.toLowerCase();
        if (!this.options.allowedLanguages.includes(langLower)) {
            throw new Error(`Language not allowed: ${language}. Supported: ${this.options.allowedLanguages.join(', ')}`);
        }

        // Security check
        this.#checkSecurity(code);

        // Get language config
        const config = this.options.languageConfig[langLower];
        if (!config) {
            throw new Error(`No configuration for language: ${language}`);
        }

        // Write code to file
        const fileName = `main.${config.ext}`;
        const filePath = path.join(this.dir, fileName);
        
        // Check file size
        if (code.length > this.options.maxFileSize) {
            throw new Error(`Code exceeds maximum size of ${this.options.maxFileSize} bytes`);
        }
        
        fs.writeFileSync(filePath, code);

        // Build command
        const { command, cmdArgs } = this.#buildCommand(config, filePath, args);

        return this.#execute(command, cmdArgs, { cwd, env, timeout: options.timeout });
    }

    #checkSecurity(code) {
        for (const pattern of this.options.blockedPatterns) {
            if (pattern.test(code)) {
                throw new Error(`Security violation: blocked pattern detected`);
            }
        }
    }

    #buildCommand(config, filePath, extraArgs) {
        if (!config.run || config.run.length === 0) {
            // No execution (e.g., HTML, CSS)
            return { command: 'true', cmdArgs: [] };
        }

        const cmdArgs = [...config.args(filePath), ...extraArgs];
        return { command: config.run[0], cmdArgs: [...config.run.slice(1), ...cmdArgs] };
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
                TEMP: this.dir,
                TMP: this.dir,
                PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
                NODE_PATH: '/usr/local/lib/node_modules',
                ...options.env,
                // Security: Remove sensitive vars
                AWS_ACCESS_KEY_ID: '',
                AWS_SECRET_ACCESS_KEY: '',
                API_KEY: '',
                SECRET: '',
                PASSWORD: '',
                TOKEN: '',
            };

            this.process = spawn(command, cmdArgs, {
                cwd: options.cwd,
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
                    memory: 0,
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

    async executeWithAnalysis(code, language, aiService) {
        const result = await this.execute(code, language);
        
        if (aiService && (result.stderr || result.exitCode !== 0)) {
            const analysis = await aiService.getChat(`
                Analyze this code execution result:
                
                Exit Code: ${result.exitCode}
                Stdout: ${result.stdout.substring(0, 1000)}
                Stderr: ${result.stderr.substring(0, 1000)}
                Duration: ${result.duration}ms
                
                What went wrong and how can it be fixed? Be specific.
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
