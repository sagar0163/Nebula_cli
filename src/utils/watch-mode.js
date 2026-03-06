// Watch Mode for Nebula-CLI
// Auto-fix issues when files change

import chalk from 'chalk';
import { watch } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AIService } from '../services/ai.service.js';
import { NamespacedVectorMemory } from '../services/namespaced-memory.js';

const execAsync = promisify(exec);

export class WatchMode {
    constructor(options = {}) {
        this.path = options.path || process.cwd();
        this.extensions = options.extensions || ['.js', '.ts', '.json', '.yaml', '.yml'];
        this.debounceMs = options.debounce || 2000;
        this.autoFix = options.autoFix || false;
        this.aiService = new AIService();
        this.memory = new NamespacedVectorMemory();
        this.watchers = [];
        this.debounceTimers = new Map();
    }

    /**
     * Start watching the directory
     */
    async start() {
        console.log(chalk.cyan(`👀 Starting watch mode on: ${this.path}`));
        console.log(chalk.gray(`   Extensions: ${this.extensions.join(', ')}`));
        console.log(chalk.gray(`   Auto-fix: ${this.autoFix ? 'enabled' : 'disabled'}`));
        console.log(chalk.yellow('\n🛑 Press Ctrl+C to stop\n'));

        await this.memory.initialize(this.path);

        // Watch for file changes
        for (const ext of this.extensions) {
            this.#watchExt(this.path, ext);
        }

        // Watch for errors in background processes
        this.#watchErrors();
    }

    /**
     * Watch for specific extension changes
     */
    #watchExt(dir, ext) {
        try {
            const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
                if (!filename) return;
                if (!filename.endsWith(ext)) return;
                if (filename.includes('node_modules')) return;
                if (filename.includes('.git')) return;

                this.#debounce(filename, () => {
                    console.log(chalk.gray(`📝 ${eventType}: ${filename}`));
                    this.#analyzeFile(filename);
                });
            });

            this.watchers.push(watcher);
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Cannot watch ${ext}: ${error.message}`));
        }
    }

    /**
     * Debounce file changes
     */
    #debounce(key, fn) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            fn();
        }, this.debounceMs);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Analyze a changed file for issues
     */
    async #analyzeFile(filename) {
        try {
            // Check for common issues
            const { stdout, stderr } = await execAsync(`npx eslint "${filename}" --format json 2>/dev/null`, {
                cwd: this.path,
                timeout: 10000
            });

            if (stderr && stderr.includes('error')) {
                console.log(chalk.red(`   ❌ Lint errors found in ${filename}`));

                if (this.autoFix) {
                    console.log(chalk.cyan('   🔧 Attempting auto-fix...'));
                    try {
                        await execAsync(`npx eslint "${filename}" --fix`, { cwd: this.path });
                        console.log(chalk.green('   ✅ Auto-fixed!'));
                    } catch (e) {
                        console.log(chalk.yellow('   ⚠️  Could not auto-fix'));
                    }
                }
            } else {
                console.log(chalk.green(`   ✅ ${filename} looks good`));
            }
        } catch (error) {
            // No lint errors or eslint not configured
        }
    }

    /**
     * Watch for command errors in background
     */
    #watchErrors() {
        // Listen for process errors
        process.on('uncaughtException', async (error) => {
            console.log(chalk.red(`\n💥 Error detected: ${error.message}`));

            if (this.autoFix) {
                console.log(chalk.cyan('🤖 Analyzing error...'));
                const diagnosis = await this.aiService.getFix(error.message, 'Error in watched project');
                console.log(chalk.cyan(`💡 Suggestion: ${diagnosis.response}`));
            }
        });
    }

    /**
     * Stop watching
     */
    stop() {
        console.log(chalk.yellow('\n👋 Stopping watch mode...'));
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}

export default WatchMode;
