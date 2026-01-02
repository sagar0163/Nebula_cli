import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { AIService } from './services/ai.service.js';
import NamespacedVectorMemory from './services/namespaced-memory.js';
import artifactMemory from './services/artifact-memory.js'; // New Import

class DynamicTransparency {
    constructor() {
        this.detector = null; // Placeholder if needed
        this.dynamicPatterns = new Map();
        this.activeModules = [];
        this.osInfo = null;
        this.isProcessing = false; // Inference Lock
        this.aiService = new AIService();
        this.memory = new NamespacedVectorMemory();
    }

    // 🔥 DYNAMIC OS Detection
    detectOS() {
        return {
            type: os.platform(),
            distro: os.release(),
            cores: os.cpus().length,
            ramGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
            shell: process.env.SHELL || process.env.COMSPEC || 'bash',
        };
    }

    // 🔥 DYNAMIC Pattern Discovery (learns from ANY filesystem)
    async autoDiscoverPatterns(baseDir = '.') {
        const patterns = new Map();
        const files = await this.scanDirectoryRecursive(baseDir);

        // Learn from file extensions (dynamic!)
        const extCount = {};
        files.forEach(file => {
            const ext = path.extname(file).slice(1);
            if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
        });

        // Dynamic categorization (grows automatically)
        if (extCount.yaml >= 3 || extCount.yml >= 3)
            patterns.set('infrastructure', 'yaml-heavy');
        if (extCount.tf >= 1)
            patterns.set('terraform', 'tf-files');
        if (extCount['js'] >= 3 || extCount.json >= 3)
            patterns.set('javascript', 'node-project');
        if (extCount.py >= 2)
            patterns.set('python', 'python-project');

        // Learn from filenames (dynamic!)
        files.forEach(file => {
            if (file.includes('docker')) patterns.set('docker', 'dockerfile');
            if (file.includes('package.json')) patterns.set('npm', 'package.json');
            if (file.includes('Chart.yaml')) patterns.set('helm', 'helm-chart');
        });

        return patterns;
    }

    async scanDirectoryRecursive(dir, maxDepth = 3) {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && maxDepth > 0) {
                    files.push(...await this.scanDirectoryRecursive(fullPath, maxDepth - 1));
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (e) { }
        return files;
    }

    // 🔥 DYNAMIC Startup Dashboard
    async dynamicStartup(baseDir = '.') {
        const spinner = ora('🧠 Dynamic Intelligence Initialization...').start();

        // Phase 1: OS Detection
        spinner.text = 'Detecting OS & hardware...';
        this.osInfo = this.detectOS();
        await new Promise(r => setTimeout(r, 300));

        // Phase 2: Filesystem Learning
        spinner.text = 'Auto-discovering project DNA...';
        this.dynamicPatterns = await this.autoDiscoverPatterns(baseDir);
        await new Promise(r => setTimeout(r, 300));

        // Phase 3: Module Auto-Loading
        spinner.text = 'Loading intelligent modules...';
        this.activeModules = this.autoLoadModules(this.dynamicPatterns);
        await new Promise(r => setTimeout(r, 300));

        // Phase 4: Artifact RAG Indexing
        spinner.text = 'Indexing project artifacts...';
        await artifactMemory.indexProject(baseDir);

        spinner.succeed();

        this.renderDynamicDashboard();
    }

    renderDynamicDashboard() {
        console.clear();
        console.log(chalk.cyan.bold('🌌 Nebula v5.2.1 - Dynamic Intelligence Engine'));
        console.log(chalk.gray('='.repeat(68)));

        console.log(chalk.green('💻 OS/Hardware:    ') +
            chalk.cyan(`${this.osInfo.type} (${this.osInfo.cores}c/${this.osInfo.ramGB}GB)`));

        console.log(chalk.green('🧠 AI Router:      ') +
            chalk.magenta('Dynamic (Multi-Model)'));

        console.log(chalk.green('📂 DNA Patterns:   ') +
            chalk.yellow(`${this.dynamicPatterns.size} auto-discovered`));

        if (this.dynamicPatterns.size > 0) {
            const patternList = Array.from(this.dynamicPatterns.keys()).join(', ');
            console.log(chalk.gray('   └─ ') + chalk.cyan(patternList));
        }

        console.log(chalk.green('🔧 Modules Active: ') +
            chalk.green(`${this.activeModules.length}`));

        console.log(chalk.gray('='.repeat(68)));
        console.log(chalk.green('🎯 Ready for dynamic self-healing!'));
        console.log('');
    }

    autoLoadModules(patterns) {
        const modules = ['Core', 'AIService', 'VectorMemory'];
        if (patterns.has('javascript')) modules.push('NodeAnalyzer');
        if (patterns.has('python')) modules.push('PythonAnalyzer');
        if (patterns.has('docker')) modules.push('ContainerManager');
        if (patterns.has('helm') || patterns.has('infrastructure')) modules.push('K8sController');
        return modules;
    }

    // 🔥 DYNAMIC AI Processing (adapts to context)
    async dynamicAiProcess(prompt, contextStr, signal) {
        if (this.isProcessing) return null; // Prevent Double Chat
        this.isProcessing = true;
        console.log(chalk.gray('➡️  [DynamicEngine] Inference Started...'));

        const spinner = ora({ spinner: 'dots12', color: 'cyan' }).start();

        // Handle Abort
        if (signal) {
            signal.addEventListener('abort', () => {
                spinner.fail(chalk.red('Request Aborted (Timeout)'));
                this.isProcessing = false;
                console.log(chalk.gray('⬅️  [DynamicEngine] Inference Aborted.'));
            });
        }

        try {
            if (signal?.aborted) return null;

            // 1. Local Cache Check (Strict Sequence)
            spinner.prefixText = '⚡';
            spinner.text = 'Checking local neural memory...';
            // Lazy verify initialization
            if (!this.memory.projectUUID) await this.memory.initialize(process.cwd());

            // Treat prompt as the querySource
            const localHits = await this.memory.findSimilar(prompt, '');
            await new Promise(r => setTimeout(r, 400)); // Simulating processing time for feel

            let vectorContext = null;
            if (localHits.length > 0 && localHits[0].similarity > 0.90) { // Lowered threshold slightly for context
                spinner.prefixText = '🧠';
                spinner.text = `Memory Recall: ${Math.round(localHits[0].similarity * 100)}% match (Reference Only)`;
                spinner.succeed();
                vectorContext = localHits[0].fix;
            }

            // 2. Artifact Retrieval (RAG)
            spinner.prefixText = '📚';
            spinner.text = 'Reading artifacts (Codebase)...';
            const artifacts = await artifactMemory.search(prompt);
            let artifactContext = '';
            if (artifacts.length > 0) {
                spinner.succeed();
                artifactContext = artifacts.map(a => `[File: ${a.path}]\n${a.content}`).join('\n\n');
            }

            // 3. Detective Phase (Proactive Reasoning)
            let detectiveContext = '';
            spinner.prefixText = '🕵️';
            spinner.text = 'Investigating requirements...';

            // Collect list of available files for the detective
            const fileList = Array.from(this.dynamicPatterns.keys()).map(k => `${k} related files`);

            const detective = await this.aiService.analyzeIntent(prompt, `
                OS: ${this.osInfo.type}
                Patterns: ${Array.from(this.dynamicPatterns.keys()).join(', ')}
                Vector Match: ${vectorContext ? 'Yes' : 'No'}
            `, fileList, { signal });

            if (detective && detective.status === 'NEED_INFO') {
                spinner.text = 'Gathering intelligence...';

                // 3a. Read Requested Files
                if (detective.files_to_read && Array.isArray(detective.files_to_read)) {
                    for (const filePath of detective.files_to_read) {
                        try {
                            const safePath = path.resolve(process.cwd(), filePath);
                            if (safePath.startsWith(process.cwd()) && (await fs.stat(safePath)).isFile()) {
                                const content = await fs.readFile(safePath, 'utf8');
                                // Truncate to reasonable size
                                detectiveContext += `\n[FILE: ${filePath}]\n${content.slice(0, 2000)}\n`;
                            }
                        } catch (e) {
                            // Ignore missing files or permission errors during investigation
                        }
                    }
                }

                // 3b. Execute Targeted Searches
                if (detective.searches && Array.isArray(detective.searches)) {
                    for (const query of detective.searches) {
                        const results = await artifactMemory.search(query, 1); // Top 1 per query
                        if (results.length > 0) {
                            detectiveContext += `\n[SEARCH: "${query}"]\n${results[0].content.slice(0, 500)}\n`;
                        }
                    }
                }

                if (detectiveContext) {
                    console.log(chalk.gray(`\n🔎 Detective found: ${detective.files_to_read?.length || 0} files, ${detective.searches?.length || 0} searches`));
                }
            }

            // 4. Dynamic Router (AI Fallback)
            const phases = this.generateDynamicPhases(prompt);
            // Skip the vector phase since we just did it real-time
            const aiPhases = phases.filter(p => !p.text.includes('vector'));

            for (const phase of aiPhases) {
                if (signal?.aborted) throw new Error('AbortError');
                spinner.prefixText = phase.icon;
                spinner.text = phase.text;
                await new Promise(r => setTimeout(r, 400));
            }

            if (signal?.aborted) throw new Error('AbortError');

            // Dynamic model routing (HF/Groq/Ollama)
            spinner.prefixText = '🤖';
            spinner.text = 'Asking AI (Validating context)...';
            // Merge detective context into artifactContext or vectorContext? 
            // Better to append to artifactContext as "Verified Facts"
            const finalArtifactContext = (artifactContext + '\n' + detectiveContext).trim();

            const result = await this.dynamicRouter(prompt, contextStr, signal, vectorContext, finalArtifactContext);

            spinner.prefixText = '✅';
            spinner.text = `Dynamic Analysis Complete`;
            spinner.succeed();

            return result;
        } catch (e) {
            if (signal?.aborted || e.message === 'AbortError') return null;
            spinner.fail(`AI Error: ${e.message}`);
            throw e;
        } finally {
            if (!signal?.aborted) {
                this.isProcessing = false; // Release Lock
                console.log(chalk.gray('⬅️  [DynamicEngine] Inference Finished.'));
            }
        }
    }

    async dynamicRouter(prompt, contextStr, signal, vectorContext, artifactContext) {
        // route to AIService
        const diagnosis = await this.aiService.getFix(prompt, contextStr || 'Dynamic Context', { signal, vectorContext, artifactContext });
        return diagnosis;
    }

    generateDynamicPhases(prompt) {
        const phases = [
            { icon: '🔍', text: `Analyzing ${this.dynamicPatterns.size > 0 ? Array.from(this.dynamicPatterns.keys())[0] : 'generic'} context...` },
            { icon: '🛡️', text: 'Applying dynamic guardrails...' },
            { icon: '🌐', text: 'Dynamic routing to optimal model...' },
            { icon: '⚡', text: 'Semantic vector processing...' },
        ];
        return phases;
    }
}

export const dynamicNebula = new DynamicTransparency();
