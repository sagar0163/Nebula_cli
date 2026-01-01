import { spawn } from 'child_process';
import os from 'os';

import chalk from 'chalk';

export const executeSystemCommand = (command, options = {}) => {
    const cmdType = classifyCommand(command);
    const baseTimeout = getDynamicTimeout(cmdType, command);
    const timeoutMs = baseTimeout * 1000;

    // Only log significant timeouts to avoid noise for 'ls' etc, or log all as requested? 
    // User showed usage: "ls -> 30s". I will follow user's log style.
    if (cmdType !== 'short') { // optional noise reduction, but user showed 'minikube' logging. 
        console.log(chalk.gray(`⏱️  Timeout: ${baseTimeout}s (${cmdType})`));
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, {
            shell: true,
            cwd: options.cwd || process.cwd(),
            stdio: ['inherit', 'pipe', 'pipe'] // User code had pipe for stdout/stderr to capture output
        });

        let output = '';
        let timedOut = false;
        let startTime = Date.now();
        let lastOutputTime = Date.now();

        // Background monitor (non-blocking) - 3s updates
        const monitor = setInterval(() => {
            if (child.killed || timedOut) return;

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const remaining = Math.max(0, (baseTimeout - (Date.now() - startTime) / 1000)).toFixed(0);
            const kbProcessed = (output.length / 1024).toFixed(1);

            // 🟢 Active if recent output, 🟡 Stalled otherwise
            const timeSinceLastOutput = Date.now() - lastOutputTime;
            const status = timeSinceLastOutput < 10000 ? chalk.green('🟢 Active') : chalk.yellow('🟡 Stalled');

            // Only show progress for long commands to keep short ones clean
            if (cmdType !== 'short') {
                process.stdout.write(chalk.gray(`\r🔄 ${elapsed}s elapsed | ${remaining}s left | ${kbProcessed}KB | ${status}   `));
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
            reject(new Error(`Timeout ${baseTimeout}s - ${cmdType}`));
        }, timeoutMs);

        child.on('close', (code) => {
            clearTimeout(timeout);
            clearInterval(monitor);
            if (cmdType !== 'short') process.stdout.write('\n'); // Newline after progress

            if (code === 0) {
                resolve(output); // Return string for compatibility
            } else {
                // If it failed, we prefer to resolve with output if we can contextually, 
                // but existing API rejects. Let's reject with Error(output or stderr).
                // Actually session.js expects rejection to handle exit code.
                // But session.js uses .catch(err => ...).
                // Let's attach output to error?
                const err = new Error(output || `Command failed with code ${code}`);
                // err.exitCode = code; // Optional
                reject(err);
            }
        });
    });
};

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
        minikube: 180,      // start/stop/delete
        helm: 240,          // install/upgrade heavy
        kubectl_long: 90,   // apply/create
        docker_build: 600,  // Image builds
        npm_install: 300,
        short: 30,
        default: 30
    };
    return timeouts[type] || 30;
}

export const executioner = {
    execute: executeSystemCommand
};

