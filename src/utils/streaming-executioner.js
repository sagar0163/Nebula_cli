// 2026 Streaming Executioner with Real-time Output
import { spawn } from 'child_process';
import os from 'os';
import chalk from 'chalk';

export class StreamingExecutor {
    constructor() {
        this.activeProcesses = new Map();
    }

    // 2026: Streaming execution with real-time output
    async *executeStream(command, options = {}) {
        const {
            cwd = process.cwd(),
            timeout = 300,
            onProgress = null,
            shell = true,
        } = options;

        const cmdType = this.#classifyCommand(command);
        const startTime = Date.now();
        const processId = `proc_${Date.now()}`;

        const child = spawn(command, {
            shell,
            cwd,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.activeProcesses.set(processId, child);

        let output = '';
        let lastOutputTime = Date.now();

        // Progress monitor
        const monitor = setInterval(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const kbProcessed = (output.length / 1024).toFixed(1);
            const status = Date.now() - lastOutputTime < 10000 ? '🟢' : '🟡';
            
            if (onProgress) {
                onProgress({ elapsed, kb: kbProcessed, status });
            }
        }, 2000);

        // Stream stdout
        child.stdout.on('data', (data) => {
            output += data;
            lastOutputTime = Date.now();
            yield { type: 'stdout', data: data.toString() };
        });

        // Stream stderr
        child.stderr.on('data', (data) => {
            output += data;
            lastOutputTime = Date.now();
            yield { type: 'stderr', data: data.toString() };
        });

        // Handle completion
        const exitCode = await new Promise((resolve) => {
            child.on('close', (code) => {
                clearInterval(monitor);
                this.activeProcesses.delete(processId);
                resolve(code);
            });
            
            // Timeout
            setTimeout(() => {
                if (this.activeProcesses.has(processId)) {
                    child.kill('SIGTERM');
                    clearInterval(monitor);
                    this.activeProcesses.delete(processId);
                    resolve(-1); // Timeout
                }
            }, timeout * 1000);
        });

        return {
            output,
            exitCode,
            duration: Date.now() - startTime,
        };
    }

    // 2026: Parallel execution for multiple commands
    async executeParallel(commands, options = {}) {
        const { concurrency = 3 } = options;
        const results = [];
        
        // Process in batches
        for (let i = 0; i < commands.length; i += concurrency) {
            const batch = commands.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(cmd => this.executeStream(cmd, options).catch(e => ({ error: e.message })))
            );
            results.push(...batchResults);
        }
        
        return results;
    }

    // 2026: Background execution with job tracking
    spawnBackground(command, options = {}) {
        const { name = 'job', cwd = process.cwd() } = options;
        
        const child = spawn(command, {
            shell: true,
            cwd,
            detached: true,
            stdio: 'ignore'
        });

        const jobId = `bg_${Date.now()}`;
        const job = {
            id: jobId,
            name,
            pid: child.pid,
            startTime: Date.now(),
            process: child,
        };

        child.unref();
        
        return job;
    }

    // 2026: Pipe multiple commands
    async pipe(commands) {
        if (commands.length < 2) {
            throw new Error('Pipe requires at least 2 commands');
        }

        let previousProcess = null;
        let finalOutput = '';

        for (const cmd of commands) {
            const processOptions = previousProcess 
                ? { stdio: ['pipe', 'pipe', 'pipe'] }
                : { stdio: ['ignore', 'pipe', 'pipe'] };

            const child = spawn(cmd, {
                shell: true,
                ...processOptions
            });

            if (previousProcess) {
                previousProcess.stdout.pipe(child.stdin);
            }

            const output = await new Promise((resolve) => {
                let data = '';
                child.stdout.on('drain', () => {
                    // Flow control
                });
                child.stdout.on('data', (chunk) => {
                    data += chunk;
                });
                child.on('close', () => {
                    resolve(data);
                });
            });

            finalOutput = output;
            previousProcess = child;
        }

        return finalOutput;
    }

    #classifyCommand(command) {
        const cmd = command.toLowerCase().trim();
        const shortCmds = ['ls', 'pwd', 'date', 'whoami', 'echo', 'cd', 'cat'];
        
        if (shortCmds.includes(cmd.split(' ')[0])) return 'short';
        if (cmd.includes('docker') || cmd.includes('kubectl') || cmd.includes('npm install')) return 'long';
        return 'medium';
    }

    // List active processes
    listActive() {
        return Array.from(this.activeProcesses.entries()).map(([id, proc]) => ({
            id,
            pid: proc.pid,
            running: !proc.killed,
        }));
    }

    // Kill process
    kill(processId) {
        const proc = this.activeProcesses.get(processId);
        if (proc) {
            proc.kill('SIGTERM');
            this.activeProcesses.delete(processId);
            return true;
        }
        return false;
    }
}

// Export singleton
export const streamingExecutor = new StreamingExecutor();

// Backward compatibility
export const executeSystemCommand = async (command, options = {}) => {
    const result = await streamingExecutor.executeStream(command, options);
    return result.output;
};
