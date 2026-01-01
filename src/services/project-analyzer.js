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
        console.log(chalk.blue('\n🧠 Analyzing project...\n'));

        // Use current session CWD if available, else process.cwd()
        const cwd = SessionContext.getCwd() || process.cwd();
        const fingerprint = await ProjectFingerprint.generate(cwd);

        const systemPrompt = `
SENIOR DEVOPS ENGINEER MODE.

Project Structure:
${JSON.stringify(fingerprint, null, 2)}

Question: "${question}"

RULES:
1. Reply with 3-5 STEP-BY-STEP SHELL COMMANDS only.
2. Each step numbered (1., 2., etc.).
3. Use EXACT file paths from structure above.
4. Prefer non-destructive commands first.
5. End with verification command.
6. If the user asks for a command, assume they want to run it on this project structure.

EXAMPLE:
1. kubectl create ns tyk
2. cd charts && helm upgrade tyk .
3. kubectl get pods -n tyk
`;

        try {
            const response = await aiService.getFix(systemPrompt + question, 'ask-mode', {
                task: 'project_inquiry',
                cwd
            });

            // Adaptation: getFix returns { response: ... } or just string?
            // Looking at ai.service.js, getFix returns { response, source }.
            // Use response.response.

            const plan = response.response;

            console.log(chalk.bold('\n📋 Action Plan:'));
            console.log(chalk.green(plan));

            const { execute } = await inquirer.prompt([{
                type: 'list',
                name: 'execute',
                message: 'What next?',
                choices: [
                    'Execute first step',
                    'Execute all steps',
                    'Copy to clipboard', // Would need clipboardy, skipping for now as per user code
                    'Skip'
                ]
            }]);

            if (execute.includes('Execute')) {
                await this.executePlan(plan, execute === 'Execute first step');
            }

        } catch (error) {
            console.log(chalk.yellow('Analysis failed:', error.message));
        }
    }

    static async executePlan(plan, firstOnly = false) {
        const lines = plan.split('\n');
        const commands = [];

        for (const line of lines) {
            const match = line.match(/^\d+\.\s*(.+)/);
            if (match) {
                commands.push(match[1].trim());
            }
        }

        if (commands.length === 0) {
            console.log(chalk.yellow('No executable commands found in plan.'));
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
