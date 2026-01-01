import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { executeSystemCommand } from './executioner.js'; // Import executioner

class SessionContext {
    constructor() {
        this.cwd = process.cwd();
        this.history = []; // { command, success, stderr?, timestamp }[]
        this.maxHistory = 50;
        this.projectMap = null;
    }

    async initialize(cwd) {
        this.cwd = cwd;
        const mapPath = path.join(cwd, '.nebula_map.json');

        // SMART UPDATE CHECK
        let shouldUpdate = true;

        if (fs.existsSync(mapPath)) {
            try {
                // 1. Check age
                const mapStats = fs.statSync(mapPath);
                const mapAge = Date.now() - mapStats.mtimeMs;
                const mapMtime = mapStats.mtimeMs;

                // 2. Check for file changes (expensive check, so maybe skip if map is very fresh < 10s?)
                // Actually user wants "Latest File > Map Mtime".
                // We'll use a fast scanner that ignores node_modules
                const latestFile = this.getLatestFileMtime(cwd);

                if (latestFile > mapMtime || mapAge > 3600000) { // 1 hour
                    console.log(chalk.yellow('🧠 Project changed or map stale. Updating...'));
                    shouldUpdate = true;
                } else {
                    this.projectMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
                    console.log(chalk.gray('🧠 Project Map Loaded (Cached)'));
                    shouldUpdate = false;
                }
            } catch (e) {
                console.log(chalk.yellow('⚠️ Map check failed, regenerating...'));
                shouldUpdate = true;
            }
        }

        if (shouldUpdate) {
            const { CommandPredictor } = await import('./project-scanner.js');
            console.log(chalk.blue('🧠 Analyzing Project Structure & README...'));
            this.projectMap = await CommandPredictor.fullProjectMap(cwd);
        }
    }

    getLatestFileMtime(cwd) {
        let latest = 0;
        const ignore = ['.git', 'node_modules', '.nebula_map.json', 'dist', 'coverage', '.DS_Store'];

        const scan = (dir, depth = 0) => {
            if (depth > 6) return; // limit depth
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (ignore.includes(entry.name)) continue;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        scan(fullPath, depth + 1);
                    } else {
                        const mtime = fs.statSync(fullPath).mtimeMs;
                        if (mtime > latest) latest = mtime;
                    }
                }
            } catch (e) {
                // ignore permission errors
            }
        };

        scan(cwd);
        return latest;
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

    getFullLog() {
        return this.history.map(entry => {
            return `[${entry.timestamp}] ${entry.command}\nResult: ${entry.success ? 'OK' : 'FAIL'}\nOutput: ${entry.output || entry.stderr || ''}\n----------------------------------`;
        }).join('\n');
    }
}

const instance = new SessionContext();
export default instance;
