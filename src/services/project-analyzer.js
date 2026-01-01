import chalk from 'chalk';
import inquirer from 'inquirer';
// Use the v4.0 Fingerprint scanner
import { ProjectFingerprint } from '../utils/project-fingerprint.js';
import { AIService } from './ai.service.js';
import { executeSystemCommand } from '../utils/executioner.js';
import SessionContext from '../utils/session-context.js';

const aiService = new AIService();

export class ProjectAnalyzer {
    static async ask(question) {
        // Use current session CWD if available, else process.cwd()
        const cwd = SessionContext.getCwd() || process.cwd();
        const fingerprint = await ProjectFingerprint.generate(cwd);

        console.log(chalk.blue(`🧠 [${fingerprint.type}] ${question}`));

        // CRITICAL FIX: Do NOT send raw JSON. It causes "parrot" hallucinations.
        // Send a summarized view of the project structure.
        const contextSummary = `
Type: ${fingerprint.type}
Files: ${fingerprint.files.map(f => f.path).join(', ')}
Key Manifests: ${fingerprint.k8sFiles.join(', ')}
Package: ${fingerprint.packageJson ? 'yes' : 'no'}
        `.trim();

        const response = await aiService.getFix(`DevOps expert.
Context:
${contextSummary}

Instructions:
Give 1-3 numbered SHELL COMMANDS only.
No conversational filler.
No markdown code blocks (just the commands).
No sudo apt installs.

User: "${question}"`, 'ask-mode', {
            task: 'project_inquiry',
            cwd
        });

        // Adaptation: getFix returns { response: ... }
        const text = response.response;

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
        const { step } = await inquirer.prompt([{
            type: 'list',
            name: 'step',
            message: 'Execute?',
            choices: [
                'First step',
                'All steps',
                'Skip'
            ]
        }]);

        if (step === 'First step') {
            await this.executePlan(steps.join('\n'), true); // Re-using executePlan logic by joining
        } else if (step === 'All steps') {
            await this.executePlan(steps.join('\n'), false);
        }
    }

    static async executePlan(planRaw, firstOnly = false) {
        // planRaw is just newline separated commands now
        const commands = planRaw.split('\n').map(c => c.trim()).filter(Boolean);

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
