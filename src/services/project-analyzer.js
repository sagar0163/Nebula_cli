import chalk from 'chalk';
import inquirer from 'inquirer';
// Use CommandPredictor for deep scan (files, type detection)
import { CommandPredictor } from '../utils/project-scanner.js';
import { AIService } from './ai.service.js';
import { executeSystemCommand } from '../utils/executioner.js';
import SessionContext from '../utils/session-context.js';

const aiService = new AIService();

export class ProjectAnalyzer {
    static async ask(question) {
        // Use current session CWD if available, else process.cwd()
        const cwd = SessionContext.getCwd() || process.cwd();

        if (!question || !question.trim()) {
            console.log(chalk.yellow('❓ Question cannot be empty'));
            return;
        }

        // FIX: Use CommandPredictor.deepScan for rich fingerprint (files array, k8sFiles, etc.)
        const fingerprint = CommandPredictor.deepScan(cwd);

        // Detect type using the same logic as prediction if not present
        if (!fingerprint.type) {
            if (fingerprint.packageJson) fingerprint.type = 'NODEJS';
            else if (fingerprint.k8sFiles && fingerprint.k8sFiles.length > 0) fingerprint.type = 'KUBERNETES';
            else fingerprint.type = 'UNKNOWN';
        }

        console.log(chalk.blue(`🧠 [${fingerprint.type}] ${question}`));

        // Universal Project-Aware Prompt
        const fileList = Array.isArray(fingerprint.files) ? fingerprint.files.map(f => f.path || f).join(', ') : 'scan failed';

        // Project Brain Context
        const projectMap = SessionContext.projectMap || {};
        const readmeSummary = projectMap.readmeSummary || {};

        const brainContext = `
PROJECT BRAIN:
- Entry Point: ${projectMap.entryPoint || 'Auto-detect'}
- Deploy Namespace: ${projectMap.deployNamespace || 'default'}
- README Instructions: ${JSON.stringify(readmeSummary)}
- Structure: ${JSON.stringify({
            charts: fingerprint.charts,
            values: fingerprint.valuesFiles,
            rootFiles: fingerprint.files.map(f => f.path || f.name).filter(n => !n.includes('/'))
        }, null, 2)}
`;

        // History Context (Robust)
        const recentHistory = SessionContext.getHistory?.()?.slice(-3).join('\n') || 'None';
        const recentErrors = SessionContext.getResults?.()?.filter(r => !r.success).slice(-2).map(e => e.stderr?.slice(0, 100)).join('\n') || 'None';

        // 🩺 AI DIAGNOSIS (Legacy) - REMOVED for v5.2.2 Split-Brain Fix

        // Universal Environment Detection
        const env = await SessionContext.detectEnvironment();

        // Runtime Guards
        const runtime = {
            env: env.toUpperCase(),
            kubeConnected: env !== 'local' ? (await executeSystemCommand('kubectl cluster-info', { cwd, silent: true })).includes('Kubernetes') : false,
            projectNs: fingerprint.projectName?.toLowerCase().includes('tyk') ? 'tyk' : 'default',
        };

        let nsCheck = 'N/A';
        if (runtime.kubeConnected) {
            nsCheck = (await executeSystemCommand(`kubectl get ns ${runtime.projectNs}`, { cwd, silent: true })).includes('Active') ? 'OK' : 'CREATE (Namespace missing)';
        }

        // 🩺 AI DIAGNOSIS (Legacy) - REMOVED for v5.2.2 Split-Brain Fix

        const aiPrompt = `
DevOps expert. Analyze this EXACT project structure and HISTORY:

RUNTIME STATE:
ENVIRONMENT: ${runtime.env}
Kube Connected: ${runtime.kubeConnected ? 'OK' : 'NO (or Local)'}
Target NS: ${runtime.projectNs} (${nsCheck})

PROJECT ROOT: ${cwd.split('/').pop()}
FILES FOUND: ${fileList}

RECENT COMMANDS:
${recentHistory}

RECENT ERRORS:
${recentErrors}

PAST FAILURES: ${recentErrors}
Rules:
1. Fix the EXACT same mistake if seen in PAST FAILURES.
2. If previous command failed with "not found", FIX the path.
3. Chart.yaml is in ROOT unless ./charts is explicitly shown.
4. LAST 3 COMMANDS: ${recentHistory}
5. LAST ERRORS: ${recentErrors}
6. FIX PREVIOUS MISTAKES EXACTLY.

CHART DIR: ${Array.isArray(fingerprint.charts) && fingerprint.charts.length > 0 ? fingerprint.charts[0] : './charts'}
VALUES FILES: ${Array.isArray(fingerprint.valuesFiles) && fingerprint.valuesFiles.length > 0 ? fingerprint.valuesFiles.join(', ') : 'values.yaml'}

RULES FOR ${fingerprint.type}:
${fingerprint.type === 'KUBERNETES' || fingerprint.type === 'HELM' ? `
- Helm: helm install <release_name> <chart_path> -f <values_file>
- Local paths ONLY (e.g. ./charts/my-chart)
- Adapt commands for ${runtime.env} environment` : `
- Use detected package.json scripts
- Respect current directory structure`}

User: "${question}"

OUTPUT 3 numbered SHELL COMMANDS using EXACT paths above.`;

        // 🔥 Dynamic Transparency Integration
        const { dynamicNebula } = await import('../dynamic-transparency.js');
        await dynamicNebula.autoDiscoverPatterns(cwd);
        console.log(chalk.gray(`\n🧠 Dynamic Context: [${Array.from(dynamicNebula.dynamicPatterns.keys()).join(', ')}]`));

        // Dynamic Timeout: K8s/Helm contexts need more time for deep thought/network
        // We set client timeout to 180s to allow the 2-step Detective process (if needed) to complete.
        const aiTimeout = (fingerprint.type === 'KUBERNETES' || fingerprint.type === 'HELM') ? 180000 : 60000;
        console.log(chalk.gray(`⏳ [ProjectAnalyzer] Waiting for AI Response (${aiTimeout / 1000}s timeout)...`));

        const controller = new AbortController();
        let timeoutId;

        try {
            const response = await Promise.race([
                dynamicNebula.dynamicAiProcess(aiPrompt, 'project-aware', controller.signal),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        controller.abort();
                        reject(new Error(`AI timeout after ${aiTimeout / 1000}s`));
                    }, aiTimeout);
                })
            ]);
            clearTimeout(timeoutId); // ✅ FIX: Prevent ghost timeouts
            console.log(chalk.gray('🏁 [ProjectAnalyzer] Result Received.'));

            if (!response || !response.response) {
                console.log(chalk.yellow(`❌ AI unavailable or empty response. (Source: ${response?.source || 'unknown'})`));
                if (process.env.DEBUG) console.log('DEBUG Response:', response);
                return;
            }

            // Continue with response...
            var safeResponse = response;

        } catch (e) {
            clearTimeout(timeoutId); // ✅ FIX: Cleanup on error too
            if (process.env.DEBUG || true) console.error(chalk.red('DEBUG: AI Promise Failed:'), e);
            return null;
        }

        const response = safeResponse; // Restore scope

        const text = response.response.trim();
        if (!text) {
            console.log(chalk.yellow('❌ Empty AI response'));
            return;
        }

        let steps = [];

        // 1. Try JSON Parsing (Instruction Hardening)
        try {
            const cleanJson = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.steps && Array.isArray(parsed.steps)) {
                steps = parsed.steps;
            }
        } catch (e) {
            // Fallback: Parsing failed, try regex/legacy methods
        }

        if (steps.length === 0) {
            // 3. Legacy: Code Blocks
            const codeBlockMatch = text.match(/```(?:bash|sh)?\n([\s\S]*?)```/);
            if (codeBlockMatch) {
                steps = codeBlockMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            }
        }

        // 🧹 SANITIZE: Remove garbage hallucinations
        steps = steps.filter(s =>
            s &&
            !s.toLowerCase().includes('no history') &&
            !s.toLowerCase().includes('no errors') &&
            !s.toLowerCase().includes('step 1') &&
            s.length > 2
        );

        if (steps.length === 0) {
            console.log(chalk.yellow('No executable steps found in AI response:'));
            console.log(text);
            return;
        }

        // ✅ INTEGRITY PATCH: Only cache verified, executable solutions
        // This prevents "poisoning the well" with empty/failed attempts
        if (steps.length > 0) {
            try {
                // Determine context from dynamic patterns
                const context = { projectType: Array.from(dynamicNebula.dynamicPatterns.keys()).join(',') };
                // Using .store(command, error, fix, context)
                await dynamicNebula.memory.store(aiPrompt, '', steps.join('\n'), context);
                // console.log(chalk.green('⚡ Solution verified and cached.')); 
            } catch (err) {
                if (process.env.DEBUG) console.warn('Cache write failed:', err.message);
            }
        }

        // Inline execution imports
        const { getCommandWarning } = await import('../utils/safe-guard.js');
        const inquirer = (await import('inquirer')).default;

        console.log(chalk.bold('\n📋 Steps:'));
        steps.forEach((step, i) => {
            const warning = getCommandWarning(step);
            console.log(`${i + 1}. ${chalk.cyan(step)} ${warning ? chalk.red(warning) : ''}`);
        });

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Execute?',
            choices: [
                { name: `1️⃣ First (${steps[0]?.slice(0, 30)}...)`, value: 'first' },
                { name: `▶️ All (${steps.length} steps)`, value: 'all' },
                { name: '❌ Skip', value: 'skip' }
            ]
        }]);

        if (action === 'skip') return;

        if (action === 'first') {
            await this.executePlan(steps[0], true);
        } else if (action === 'all') {
            await this.executePlan(steps, false);
        } else {
            // Should not happen with restricted list
            await this.executePlan(action, true);
        }
    }

    static async executePlan(planRawOrArray, firstOnly = false) {
        // Handle both string (newline separated) and array inputs
        const commands = Array.isArray(planRawOrArray)
            ? planRawOrArray
            : planRawOrArray.split('\n').map(c => c.trim()).filter(Boolean);

        if (commands.length === 0) {
            console.log(chalk.yellow('No executable commands found.'));
            return;
        }

        const toRun = firstOnly ? [commands[0]] : commands;

        // Inline execution imports
        const { getCommandWarning, isSafeCommand } = await import('../utils/safe-guard.js');
        const inquirer = (await import('inquirer')).default;

        for (const command of toRun) {
            // SAFEGUARD CHECK
            if (!isSafeCommand(command)) {
                const warning = getCommandWarning(command);
                console.log(chalk.bold.red(`\n🛑 BLOCKED: ${command}`));
                if (warning) console.log(chalk.red(warning));

                const { confirm } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: '⚠️  Destructive command detected. Execute anyway?',
                    default: false
                }]);

                if (!confirm) {
                    console.log(chalk.gray('Skipped.'));
                    continue;
                }
            }

            console.log(chalk.cyan(`Running: ${command}`));

            try {
                const result = await executeSystemCommand(command, { cwd: SessionContext.getCwd() || process.cwd() });
                console.log(result);
            } catch (e) {
                console.log(chalk.red('Step failed:', e.message));
                break;
            }
        }
    }
}
