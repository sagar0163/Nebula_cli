import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import chalk from 'chalk';
import readline from 'readline';
import { z } from 'zod';

const exec = promisify(execSync);
let nodePty;

try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    nodePty = require('node-pty');
} catch (e) {
    // node-pty not available
}

// ============================================================
// DANGEROUS COMMANDS REGISTRY
// ============================================================
const DANGEROUS_PATTERNS = [
    { pattern: /rm\s+-rf\s+\//, risk: 'critical', message: 'Recursive delete from root - WILL DESTROY SYSTEM' },
    { pattern: /rm\s+-rf\s+\*/, risk: 'critical', message: 'Recursive delete all - MAY DESTROY DATA' },
    { pattern: /mkfs\./, risk: 'critical', message: 'Format filesystem - WILL DESTROY DATA' },
    { pattern: /dd\s+if=.*of=\/dev\//, risk: 'critical', message: 'Direct disk write - MAY DESTROY SYSTEM' },
    { pattern: />\s*\/dev\/sd/, risk: 'critical', message: 'Writing to disk device - MAY DESTROY DATA' },
    { pattern: /curl.*\|\s*sh/, risk: 'high', message: 'Executing remote script - POTENTIALLY DANGEROUS' },
    { pattern: /wget.*\|\s*sh/, risk: 'high', message: 'Executing remote script - POTENTIALLY DANGEROUS' },
    { pattern: /chmod\s+777/, risk: 'high', message: 'World-writable permissions - SECURITY RISK' },
    { pattern: /chown\s+-R/, risk: 'medium', message: 'Recursive ownership change' },
    { pattern: /kill\s+-9\s+-1/, risk: 'high', message: 'Kill all processes - WILL CRASH SYSTEM' },
    { pattern: /shutdown/, risk: 'high', message: 'System shutdown command' },
    { pattern: /reboot/, risk: 'high', message: 'System reboot command' },
    { pattern: /init\s+0/, risk: 'high', message: 'System halt' },
    { pattern: /init\s+6/, risk: 'high', message: 'System reboot' },
    { pattern: /systemctl\s+stop/, risk: 'medium', message: 'Stopping system service' },
    { pattern: /systemctl\s+disable/, risk: 'medium', message: 'Disabling system service' },
    { pattern: /docker\s+rm\s+-f/, risk: 'medium', message: 'Force removing containers' },
    { pattern: /docker\s+rmi\s+-f/, risk: 'medium', message: 'Force removing images' },
    { pattern: /npm\s+exec.*--\s*rm/, risk: 'medium', message: 'Package removal via npx' },
    { pattern: /pip\s+uninstall.*-y/, risk: 'low', message: 'Uninstalling Python packages' },
    { pattern: /apt\s+purge/, risk: 'medium', message: 'Purging system packages' },
    { pattern: /yum\s+remove/, risk: 'medium', message: 'Removing system packages' },
    { pattern: /deluser/, risk: 'medium', message: 'Deleting system user' },
    { pattern: /userdel/, risk: 'medium', message: 'Deleting system user' },
];

// Interactive commands that need PTY
const INTERACTIVE_COMMANDS = [
    'vim', 'nvim', 'nano', 'pico', 'emacs',
    'htop', 'top', 'btop', 'atop',
    'less', 'more',
    'ssh', 'scp', 'sftp',
    'ftp', 'telnet',
    'irssi', 'weechat', 'tin',
    'mutt', 'pine', 'alpine',
    'ranger', 'nnn', 'lf',
    'git commit', 'git rebase',
    'kubectl exec', 'docker exec',
    'mysql', 'psql', 'sqlite3',
    'mongosh',
];

// ============================================================
// SPINNER & PROGRESS UI
// ============================================================
const spinnersChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerFrame = 0;
let spinnerTimeout = null;
let spinnerActive = false;

function startSpinner(message = '') {
    stopSpinner();
    spinnerActive = true;
    
    const frame = () => {
        if (!spinnerActive) return;
        const char = spinnersChars[spinnerFrame % spinnersChars.length];
        process.stdout.write(`\r${chalk.cyan(char)} ${message}`);
        spinnerFrame++;
        spinnerTimeout = setTimeout(frame, 80);
    };
    frame();
}

function stopSpinner(success = false) {
    spinnerActive = false;
    if (spinnerTimeout) {
        clearTimeout(spinnerTimeout);
        spinnerTimeout = null;
    }
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

// ============================================================
// COMMAND ANALYSIS
// ============================================================
export function analyzeCommand(command) {
    if (!command) return { risk: 'none', needsPty: false, interactive: false };
    
    const lowerCmd = command.toLowerCase();
    
    // Check for dangerous commands
    for (const { pattern, risk, message } of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
            return { risk, message, needsPty: false, interactive: false };
        }
    }
    
    // Check for interactive commands
    const needsPty = INTERACTIVE_COMMANDS.some(cmd => lowerCmd.includes(cmd));
    
    // Check if it's a pipe to interactive command
    if (command.includes('|') && INTERACTIVE_COMMANDS.some(cmd => lowerCmd.includes(cmd))) {
        return { risk: 'low', message: 'Pipe to interactive command', needsPty: true, interactive: true };
    }
    
    return { risk: 'low', needsPty, interactive: needsPty };
}

// ============================================================
// DANGEROUS COMMAND APPROVAL
// ============================================================
export async function requireApproval(command, options = {}) {
    const analysis = analyzeCommand(command);
    
    if (analysis.risk === 'none' || analysis.risk === 'low') {
        return true; // No approval needed
    }
    
    if (!options.skipApproval && !options.approved) {
        console.log(chalk.red.bold('\n⚠️  DANGEROUS COMMAND DETECTED'));
        console.log(chalk.red(`   Risk Level: ${analysis.risk.toUpperCase()}`));
        console.log(chalk.red(`   ${analysis.message}`));
        console.log(chalk.gray(`   Command: ${command}`));
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question(chalk.yellow('\n⚠️  Are you sure you want to execute this? [y/N] '), (answer) => {
                rl.close();
                const confirmed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
                if (!confirmed) {
                    console.log(chalk.gray('   Command cancelled.'));
                }
                resolve(confirmed);
            });
        });
    }
    
    return true;
}

// ============================================================
// PTY EXECUTION (for interactive commands)
// ============================================================
export function executeWithPty(command, options = {}) {
    return new Promise((resolve, reject) => {
        if (!nodePty) {
            console.log(chalk.yellow('⚠ node-pty not installed. Running in non-interactive mode.'));
            console.log(chalk.gray('   Install with: npm install node-pty'));
            // Fallback to regular execution
            executeSystemCommand(command, { ...options, pty: false }).then(resolve).catch(reject);
            return;
        }

        const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
        const cwd = options.cwd || process.cwd();
        
        startSpinner('pty', 'Interactive terminal');
        
        const ptyProcess = nodePty.spawn(shell, ['-c', command], {
            name: 'xterm-color',
            cols: process.stdout.columns || 80,
            rows: process.stdout.rows || 24,
            cwd: cwd,
            env: { ...process.env, ...options.env }
        });

        let output = '';
        
        ptyProcess.onData((data) => {
            process.stdout.write(data);
            output += data;
        });

        ptyProcess.onExit(({ exitCode }) => {
            stopSpinner('pty', exitCode === 0);
            if (exitCode === 0) {
                resolve(output);
            } else {
                reject(new Error(`Command exited with code ${exitCode}`));
            }
        });

        // Handle resize
        if (options.resize) {
            process.stdout.on('resize', () => {
                ptyProcess.resize(process.stdout.columns, process.stdout.rows);
            });
        }
    });
}

// ============================================================
// MAIN EXECUTION FUNCTION
// ============================================================
export const executeSystemCommand = async (command, options = {}) => {
    const analysis = analyzeCommand(command);
    
    // Handle PTY for interactive commands
    if (analysis.needsPty || options.pty) {
        try {
            return await executeWithPty(command, options);
        } catch (err) {
            throw err;
        }
    }

    // Check for dangerous commands
    const approved = await requireApproval(command, options);
    if (!approved) {
        throw new Error('Command cancelled by user');
    }

    const cmdType = classifyCommand(command);
    const baseTimeout = getDynamicTimeout(cmdType, command);
    const timeoutMs = baseTimeout * 1000;

    if (cmdType !== 'short' && !options.silent) {
        startSpinner('exec', `${command.slice(0, 40)}... (${cmdType})`);
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, {
            shell: true,
            cwd: options.cwd || process.cwd(),
            stdio: options.interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, ...options.env }
        });

        let output = '';
        let timedOut = false;
        let startTime = Date.now();
        let lastOutputTime = Date.now();

        const monitor = setInterval(() => {
            if (child.killed || timedOut) return;

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const remaining = Math.max(0, (baseTimeout - (Date.now() - startTime) / 1000)).toFixed(0);
            const kbProcessed = (output.length / 1024).toFixed(1);

            const timeSinceLastOutput = Date.now() - lastOutputTime;
            const status = timeSinceLastOutput < 10000 ? chalk.green('●') : chalk.yellow('○');

            if (cmdType !== 'short' && !options.silent) {
                process.stdout.write(chalk.gray(`\r${status} ${elapsed}s | ${remaining}s left | ${kbProcessed}KB    `));
            }
        }, 3000);

        child.stdout.on('data', (data) => {
            output += data;
            lastOutputTime = Date.now();
        });

        child.stderr.on('data', (data) => {
            output += data;
            lastOutputTime = Date.now();
        });

        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
            clearInterval(monitor);
            stopSpinner('exec');
            reject(new Error(`Timeout ${baseTimeout}s - ${cmdType}`));
        }, timeoutMs);

        child.on('close', (code) => {
            clearTimeout(timeout);
            clearInterval(monitor);
            if (cmdType !== 'short' && !options.silent) {
                process.stdout.write('\n');
            }
            stopSpinner('exec', code === 0);

            if (code === 0) {
                resolve(maskSecrets(output));
            } else {
                const err = new Error(maskSecrets(output) || `Command failed with code ${code}`);
                reject(err);
            }
        });
    });
};

// ============================================================
// SUB-AGENT / SPAWN SUPPORT
// ============================================================
export class SubAgent {
    constructor(name, task, options = {}) {
        this.name = name;
        this.task = task;
        this.options = options;
        this.status = 'pending';
    }

    async run() {
        this.status = 'running';
        startSpinner(`agent-${this.name}`, `Agent: ${this.name}`);
        
        // This would integrate with the AI service
        // For now, it's a placeholder for the architecture
        try {
            // Execute the task
            const result = await executeSystemCommand(this.task, this.options);
            this.status = 'completed';
            stopSpinner(`agent-${this.name}`, true);
            return result;
        } catch (error) {
            this.status = 'failed';
            stopSpinner(`agent-${this.name}`);
            throw error;
        }
    }
}

export async function spawnAgent(name, task, options = {}) {
    const agent = new SubAgent(name, task, options);
    return agent.run();
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function maskSecrets(text) {
    if (!text) return text;
    let out = text;
    const sensitiveKeys = Object.keys(process.env).filter(key =>
        /(_KEY|_TOKEN|_SECRET|_PASSWORD)/i.test(key)
    );

    for (const key of sensitiveKeys) {
        const value = process.env[key];
        if (value && value.length > 3) {
            const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp(escapedValue, 'g'), `***${key}***`);
        }
    }
    return out;
}

function classifyCommand(command) {
    if (!command) return 'short';
    const cmd = command.split(' ')[0].toLowerCase();
    if (command.includes('minikube')) return 'minikube';
    if (command.includes('helm')) return 'helm';
    if (new RegExp(/kubectl.*(apply|create|scale)/).test(command)) return 'kubectl_long';
    if (new RegExp(/docker.*(build|run)/).test(command)) return 'docker_build';
    if (command.includes('npm install')) return 'npm_install';
    return 'short';
}

function getDynamicTimeout(type, command) {
    const timeouts = {
        minikube: 180,
        helm: 240,
        kubectl_long: 90,
        docker_build: 600,
        npm_install: 300,
        short: 30,
        default: 30
    };
    return timeouts[type] || 30;
}

// ============================================================
// TOOL REGISTRY
// ============================================================
export const ToolRegistry = {
    tools: new Map(),

    register(name, handler, options = {}) {
        this.tools.set(name, { handler, options });
    },

    get(name) {
        return this.tools.get(name);
    },

    list() {
        return Array.from(this.tools.keys());
    },

    async execute(name, ...args) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }
        return tool.handler(...args);
    }
};

// ============================================================
// EXPORTS
// ============================================================
export const executioner = {
    execute: executeSystemCommand,
    executeWithPty,
    analyze: analyzeCommand,
    requireApproval,
    spawnAgent,
    ToolRegistry
};

export default executioner;
