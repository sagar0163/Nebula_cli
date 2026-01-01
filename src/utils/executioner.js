import { spawn } from 'child_process';
import os from 'os';

export const executeSystemCommand = (command, options = {}) => {
    return new Promise((resolve, reject) => {
        // Detect OS to handle shell variations (Windows vs Unix)
        const isWindows = os.platform() === 'win32';
        const shell = isWindows ? 'powershell.exe' : '/bin/bash';

        // Use shell for command execution
        const child = spawn(command, {
            shell: true,
            cwd: options.cwd || process.cwd(),
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => (stdout += data));
        child.stderr.on('data', (data) => (stderr += data));

        child.on('close', (code) => {
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || 'Command failed'));
        });
    });
};

export const executioner = {
    execute: executeSystemCommand
};

