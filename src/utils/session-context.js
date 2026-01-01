import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { executeSystemCommand } from './executioner.js'; // Import executioner

class SessionContext {
    constructor() {
        this.cwd = process.cwd();
        this.history = []; // { command, success, stderr?, timestamp }[]
        this.maxHistory = 50;
    }

    async isMinikube() {
        try {
            const result = await executeSystemCommand('kubectl config current-context', { cwd: this.cwd });
            return result.includes('minikube');
        } catch {
            return false;
        }
    }

    async isOpenShift() {
        try {
            await executeSystemCommand('oc whoami', { cwd: this.cwd }); // Check if 'oc' works and is logged in
            return true;
        } catch {
            return false;
        }
    }

    async detectEnvironment() {
        const checks = [
            { id: 'minikube', cmd: 'kubectl config current-context | grep minikube' },
            { id: 'eks', cmd: 'aws eks list-clusters' },
            { id: 'gke', cmd: 'gcloud container clusters list' },
            { id: 'openshift', cmd: 'oc whoami' },
            { id: 'aks', cmd: 'az aks list' }
        ];

        for (const check of checks) {
            try {
                // Short timeout 2s for checks to be fast
                await executeSystemCommand(check.cmd, { cwd: this.cwd, timeout: 2000, silent: true });
                return check.id;
            } catch (e) {
                // ignore
            }
        }
        return 'local';
    }

    getCwd() {
        return this.cwd;
    }

    changeDir(target) {
        const newPath = path.resolve(this.cwd, target);
        if (!fs.existsSync(newPath) || !fs.statSync(newPath).isDirectory()) {
            console.log(chalk.yellow(`⚠️ Directory not found: ${newPath}`));
            return;
        }
        this.cwd = newPath;
        try {
            process.chdir(this.cwd);
            console.log(chalk.gray(`📁 CWD: ${this.cwd}`));
        } catch (err) {
            console.log(chalk.red(`⚠️ Failed to change directory: ${err.message}`));
        }
    }

    setCwd(newPath) {
        this.cwd = newPath;
    }

    addCommand(command) {
        this.history.push({ command, timestamp: new Date().toISOString() });
        if (this.history.length > this.maxHistory) this.history.shift();
    }

    addResult(result) {
        const last = this.history[this.history.length - 1];
        if (last) Object.assign(last, result);
    }

    getHistory() {
        return this.history.map(h => h.command);
    }

    getResults() {
        return this.history; // Full objects with stderr etc
    }

    printHistory() {
        console.log(chalk.bold('\n🕒 Nebula Session History (last 20):\n'));
        this.history.slice(-20).forEach((entry, idx) => {
            const status = entry.success ? chalk.green('OK') : chalk.red('FAIL');
            console.log(`${idx + 1}. [${status}] ${entry.command}`);
        });
        console.log('');
    }

    getHistoryForRag() {
        return this.history.slice(-5); // last 5 commands for AI context
    }
}

const instance = new SessionContext();
export default instance;
