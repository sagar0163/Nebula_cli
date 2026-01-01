#!/usr/bin/env node

import 'dotenv/config';
import { executeSystemCommand } from './utils/executioner.js';
import { AIService } from './services/ai.service.js';
import { VectorMemory } from './services/vector-memory.js';
import { isSafeCommand } from './utils/safe-guard.js';
import { startSession } from './commands/session.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import os from 'os';

console.log(chalk.cyan.bold('Nebula-CLI: The Self-Healing Terminal Agent'));

const args = process.argv.slice(2);

// No args -> Interactive Session
if (args.length === 0 || args[0] === 'session') {
    startSession();
    // We do NOT exit here, startSession handles the process lifecycle
} else {
    // One-shot command mode
    const command = args[0];
    runOneShot(command);
}

const aiService = new AIService();
const memory = new VectorMemory();

async function runOneShot(command) {
    // Sentinel Loop
    try {
        console.log(chalk.gray(`Running: ${command}`));
        const output = await executeSystemCommand(command);
        console.log(output);
    } catch (error) {
        console.error(chalk.red('\n✖ Command Failed!'));
        console.error(chalk.red(error.message));

        console.log(chalk.yellow('\n🤖 Nebula is analyzing the failure...'));

        try {
            // 1. Check Vector Memory
            let suggestedFix;
            let isCached = false;

            const similarFixes = await memory.findSimilar(command, error.message);

            if (similarFixes.length > 0) {
                const bestMatch = similarFixes[0];
                suggestedFix = bestMatch.fix;
                const similarity = (bestMatch.similarity * 100).toFixed(1);
                console.log(chalk.green.bold(`\n⚡ Instant Fix (Vector Match: ${similarity}%)`));
                isCached = true;
            } else {
                // 2. Ask AI
                const context = {
                    os: os.platform(),
                    projectType: 'node'
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

                // 3. Save to Vector Memory (if it wasn't already cached)
                if (!isCached) {
                    console.log(chalk.gray('Persisting to vector memory...'));
                    await memory.store(command, error.message, suggestedFix, {});
                }
            } else {
                console.log(chalk.gray('Modification cancelled.'));
            }

        } catch (aiError) {
            console.error(chalk.red('Failed to get AI assistance:'), aiError.message);
        }
    }
}
