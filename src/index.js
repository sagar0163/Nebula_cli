#!/usr/bin/env node

import 'dotenv/config';
import { executeSystemCommand } from './utils/executioner.js';
import { AIService } from './services/ai.service.js';
import { SemanticCache } from './utils/cache.js';
import { isSafeCommand } from './utils/safe-guard.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import os from 'os';

console.log(chalk.cyan.bold('Nebula-CLI: The Self-Healing Terminal Agent'));

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: nebula <command>');
    console.log('Example: nebula "mkdir /root/test"');
    process.exit(1);
}

const command = args[0]; // For now, treat the whole string as the command
const aiService = new AIService();
const cache = new SemanticCache();

if (command === 'shell') {
    console.log('Interactive shell appearing soon...');
    process.exit(0);
}

// Sentinel Loop
(async () => {
    try {
        console.log(chalk.gray(`Running: ${command}`));
        const output = await executeSystemCommand(command);
        console.log(output);
    } catch (error) {
        console.error(chalk.red('\n✖ Command Failed!'));
        console.error(chalk.red(error.message));

        console.log(chalk.yellow('\n🤖 Nebula is analyzing the failure...'));

        try {
            // 1. Check Cache
            let suggestedFix;
            let isCached = false;

            suggestedFix = cache.get(command, error.message);

            if (suggestedFix) {
                console.log(chalk.green.bold('\n⚡ Instant Fix (Cached Found)'));
                isCached = true;
            } else {
                // 2. Ask AI
                const context = {
                    os: os.platform(),
                    projectType: 'node' // placeholder, can detect from package.json later
                };

                const diagnosis = await aiService.getFix(error.message, command, context);
                suggestedFix = diagnosis.response;
            }

            if (!suggestedFix) {
                console.log(chalk.gray('No clear fix suggested by AI.'));
                process.exit(1);
            }

            // Safety Check
            if (!isSafeCommand(suggestedFix)) {
                console.log(chalk.red.bold(`\n⚠️  DANGER: AI suggested a destructive command: ${suggestedFix}`));
                console.log(chalk.red('Nebula Shield blocked this action.'));
                process.exit(1);
            }

            console.log(chalk.green(`\n💡 Suggested Fix: ${chalk.bold(suggestedFix)}`));

            // Human-in-the-Loop
            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Do you want to execute this fix?',
                default: false
            }]);

            if (confirm) {
                console.log(chalk.gray(`\nRunning fix: ${suggestedFix}`));
                const fixOutput = await executeSystemCommand(suggestedFix);
                console.log(fixOutput);
                console.log(chalk.green('✅ Fix applied successfully!'));

                // 3. Save to Cache (if it wasn't already cached)
                if (!isCached) {
                    cache.set(command, error.message, suggestedFix);
                }
            } else {
                console.log(chalk.gray('Modification cancelled.'));
            }

        } catch (aiError) {
            console.error(chalk.red('Failed to get AI assistance:'), aiError.message);
        }
    }
})();
