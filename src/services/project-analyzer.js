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
        // ProjectFingerprint.generate() was too shallow/different structure.
        const fingerprint = CommandPredictor.deepScan(cwd);

        // Detect type using the same logic as prediction if not present,
        // or just rely on what deepScan returns. deepScan doesn't set 'type', 
        // but predictNextCommand does. We can determine type simply here.
        if (!fingerprint.type) {
            if (fingerprint.packageJson) fingerprint.type = 'NODEJS';
            else if (fingerprint.k8sFiles && fingerprint.k8sFiles.length > 0) fingerprint.type = 'KUBERNETES';
            else fingerprint.type = 'UNKNOWN';
        }

        console.log(chalk.blue(`🧠 [${fingerprint.type}] ${question}`));

        // Universal Project-Aware Prompt
        const fileList = Array.isArray(fingerprint.files) ? fingerprint.files.map(f => f.path || f).join(', ') : 'scan failed';

        // History Context (Robust)
        const recentHistory = SessionContext.getHistory?.()?.slice(-3).join('\n') || 'no history';
        const recentErrors = SessionContext.getResults?.()?.filter(r => !r.success).slice(-2).map(e => e.stderr?.slice(0, 100)).join('\n') || 'no errors';

        // Debug: Ensure history is reaching AI
        // console.log(chalk.gray(`History: ${recentHistory}`));
        // console.log(chalk.gray(`Errors: ${recentErrors}`));

        // Universal Environment Detection
        const env = await SessionContext.detectEnvironment();

        // Runtime Guards (Connectivity Checks - Universal)
        // We only check K8s things if we are in a K8s-like environment or if project type suggests it.
        const runtime = {
            env: env.toUpperCase(),
            kubeConnected: env !== 'local' ? (await executeSystemCommand('kubectl cluster-info', { cwd, silent: true })).includes('Kubernetes') : false,
            // Generic check: detection of default namespace for current project?
            // User requested: "ProjectNs: projectName === 'tyk' ? 'tyk' : 'default'" logic is good but let's go generic.
            // If project is 'tyk-control-plane', ns might be 'tyk'.
            projectNs: fingerprint.projectName?.toLowerCase().includes('tyk') ? 'tyk' : 'default', // Heuristic for now, or just 'default'
            // We can check if that NS exists
        };

        let nsCheck = 'N/A';
        let secretCheck = 'N/A';

        if (runtime.kubeConnected) {
            nsCheck = (await executeSystemCommand(`kubectl get ns ${runtime.projectNs}`, { cwd, silent: true })).includes('Active') ? 'OK' : 'CREATE (Namespace missing)';
            // Check for likely secrets if file exists
            if (fingerprint.files.some(f => (f.path || f).includes('secret'))) {
                const secretName = `${runtime.projectNs}-global-secret`; // Guessing logic or generic?
                // User example: "tyk-global-secret"
                // Let's stick to user example for Tyk, but allow generic future.
                // For now, let's just expose the ENV and basic Kube health.
                secretCheck = (await executeSystemCommand(`kubectl get secret -n ${runtime.projectNs}`, { cwd, silent: true })).length > 0 ? 'OK (Secrets found)' : '⚠️ Check Secrets';
            }
        }

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

CHART DIR: ${Array.isArray(fingerprint.charts) && fingerprint.charts.length > 0 ? fingerprint.charts[0] : './charts'}
VALUES FILES: ${Array.isArray(fingerprint.valuesFiles) && fingerprint.valuesFiles.length > 0 ? fingerprint.valuesFiles.join(', ') : 'values.yaml'}

RULES FOR ${fingerprint.type}:
${fingerprint.type === 'KUBERNETES' || fingerprint.type === 'HELM' ? `
- Helm: helm install <name> ./${fingerprint.charts?.[0] || 'charts'} -f ${fingerprint.valuesFiles?.[0] || 'values.yaml'}
- Local paths ONLY (./charts NOT generic names)
- Adapt commands for ${runtime.env} (e.g. 'minikube dashboard', 'aws eks update-kubeconfig')` : `
- Use detected package.json scripts
- Respect current directory structure`}

User: "${question}"

OUTPUT 3 numbered SHELL COMMANDS using EXACT paths above.`;

        const response = await Promise.race([
            aiService.getFix(aiPrompt, 'project-aware', { cwd }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 10000))
        ]).catch(() => null);

        if (!response || !response.response) {
            console.log(chalk.yellow('❌ AI unavailable or empty response'));
            return;
        }

        // Adaptation: getFix returns { response: ... }
        const text = response.response.trim();
        if (!text) {
            console.log(chalk.yellow('❌ Empty AI response'));
            return;
        }

        // Parse numbered steps safely
        const steps = text.split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.split(/^\d+\.\s*/)[1]?.trim() || line.trim())
            .filter(Boolean);

        if (steps.length === 0) {
            console.log(chalk.yellow('No executable steps found in AI response:'));
            console.log(text);
            return;
        }

        // Inline execution imports
        const { getCommandWarning } = await import('../utils/safe-guard.js');
        const inquirer = (await import('inquirer')).default;

        console.log(chalk.bold('\n📋 Steps:'));
        steps.forEach((step, i) => {
            const warning = getCommandWarning(step);
            console.log(`${i + 1}. ${chalk.cyan(step)} ${warning ? chalk.red(warning) : ''}`);
        });

        // Robust Inquirer Logic
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Execute?',
            choices: [
                { name: '1. Execute first step only', value: 'first' },
                { name: '🚀 Execute ALL steps', value: 'all' }, // Pass string 'all', handle below
                { name: '❌ Skip', value: 'skip' },
                new inquirer.Separator(),
                // Map individual steps as selectable options
                ...steps.map((step, i) => ({
                    name: getCommandWarning(step)
                        ? `${chalk.red('⚠️ DANGER')}: ${step.slice(0, 50)}...`
                        : `${i + 1}. ${step.slice(0, 50)}...`,
                    value: step // The actual shell command string
                }))
            ]
        }]);

        if (action === 'skip') return;

        if (action === 'first') {
            await this.executePlan(steps[0], true);
        } else if (action === 'all') {
            await this.executePlan(steps, false); // Execute all steps
        } else {
            // User selected an individual command string
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

        for (const command of toRun) {
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
