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

        const aiPrompt = `
DevOps expert. Analyze this EXACT project structure:

PROJECT ROOT: ${cwd.split('/').pop()}
FILES FOUND: ${fileList}
CHART DIR: ${Array.isArray(fingerprint.charts) && fingerprint.charts.length > 0 ? fingerprint.charts[0] : './charts'}
VALUES FILES: ${Array.isArray(fingerprint.valuesFiles) && fingerprint.valuesFiles.length > 0 ? fingerprint.valuesFiles.join(', ') : 'values.yaml'}

RULES FOR ${fingerprint.type}:
${fingerprint.type === 'KUBERNETES' || fingerprint.type === 'HELM' ? `
- Helm: helm install <name> ./${fingerprint.charts?.[0] || 'charts'} -f ${fingerprint.valuesFiles?.[0] || 'values.yaml'}
- Local paths ONLY (./charts NOT generic names)` : `
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

        console.log(chalk.bold('\n📋 Steps:'));
        steps.forEach((step, i) => console.log(`${i + 1}. ${chalk.cyan(step)}`));

        // Inline execution
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Execute?',
            choices: [
                'first',
                'all',
                'skip'
            ]
        }]);

        if (action === 'first') {
            await this.executePlan(steps[0], true); // Steps[0] is string, executePlan handles it
        } else if (action === 'all') {
            await this.executePlan(steps, false); // Pass array directly
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
