#!/usr/bin/env node

import './utils/env-loader.js'; // Must be first
import { executeSystemCommand } from './utils/executioner.js';
import { AIService } from './services/ai.service.js';
import { VectorMemory } from './services/vector-memory.js';
import { isSafeCommand } from './utils/safe-guard.js';
import { startSession } from './commands/session.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import os from 'os';
import { execSync } from 'child_process';

console.log(chalk.cyan.bold('Nebula-CLI: The Self-Healing Terminal Agent'));

const args = process.argv.slice(2);
const aiService = new AIService();
const memory = new VectorMemory();

(async () => {
    // 1. Nebula Predict Mode
    if (args[0] === 'predict') {
        if (!process.env.NEBULA_SESSION) {
            console.log(chalk.blue('\n🔮 Gazing into the directory...'));
        }

        const { UniversalPredictor } = await import('./services/universal-predictor.js');

        try {
            const prediction = await UniversalPredictor.predict();

            console.log(chalk.bold('\n🚀 Nebula Predicts:'));
            console.log(chalk.cyan(`${prediction.rationale}`));
            console.log(chalk.green(`💡 Next: ${chalk.bold(prediction.command)}`));
            console.log(chalk.gray(`🎯 Confidence: ${(prediction.confidence * 100).toFixed(0)}%`));

            const { runIt } = await inquirer.prompt([{
                type: 'confirm',
                name: 'runIt',
                message: 'Execute?',
                default: true
            }]);

            if (runIt) {
                try {
                    const { executeSystemCommand } = await import('./utils/executioner.js');
                    await executeSystemCommand(prediction.command, { timeout: 60000 });

                    // Learn from success
                    console.log(chalk.gray('🧠 Learning this pattern...'));
                    await UniversalPredictor.learn(process.cwd(), prediction.command);

                } catch (execErr) {
                    console.log(chalk.yellow('\n⚠️ Command failed.'));
                }
            }
        } catch (err) {
            console.log(chalk.yellow('Prediction failed:', err.message));
        }
        return;
    }

    // 2. Automated Release Mode
    if (args[0] === 'release') {
        try {
            console.log(chalk.blue('📊 Analyzing change impact...'));
            // Execute impact engine
            const impact = execSync('node impact-engine.js').toString().trim();
            console.log(chalk.cyan(`💡 Detected ${chalk.bold(impact)} impact. Launching release...`));

            const { executeSystemCommand } = await import('./utils/executioner.js');
            // Execute release-it with impact and CI flag
            const releaseOutput = await executeSystemCommand(`npx release-it ${impact} --ci`, { timeout: 300000 }); // 5 min timeout for release

            console.log(releaseOutput);
            console.log(chalk.green('✅ Branch created, version updated, and pushed to origin!'));
        } catch (e) {
            console.log(chalk.red(`❌ Release failed: ${e.message}`));
        }
        return;
    }

    // 3. Ask Mode
    if (args[0] === 'ask') {
        const question = args.slice(1).join(' ');
        if (!question) {
            console.log(chalk.yellow('Usage: nebula ask "your question"'));
            return;
        }
        const { ProjectAnalyzer } = await import('./services/project-analyzer.js');
        await ProjectAnalyzer.ask(question);
        return;
    }

    // 4. Interactive Session Mode
    if (args.length === 0 || args[0] === 'session') {
        startSession();
        return;
    }

    // 3. One-Shot Command Mode
    const command = args.join(' ');
    try {
        console.log(chalk.gray(`Running: ${command}`));
        const output = await executeSystemCommand(command);
        console.log(output);
    } catch (error) {
        console.error(chalk.red('\n✖ Command Failed!'));
        console.error(chalk.red(error.message));

        console.log(chalk.yellow('\n🤖 Nebula is analyzing the failure...'));

        try {
            // Check Vector Memory
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
                // Ask AI
                const context = {
                    os: os.platform(),
                    cwd: process.cwd(),
                    projectType: 'node'
                };

                const diagnosis = await aiService.getFix(error.message, command, context);
                suggestedFix = diagnosis.response;
                console.log(chalk.cyan(`\n💡 Suggested Fix (${diagnosis.source}): ${chalk.bold(suggestedFix)}`));
            }

            if (!suggestedFix) {
                console.log(chalk.gray('No clear fix found.'));
                process.exit(1);
            }

            // Safety Check
            if (!isSafeCommand(suggestedFix)) {
                console.log(chalk.red.bold(`\n⚠️  DANGER: Destructive command detected.`));
                console.log(chalk.red(`Refusing to run: ${suggestedFix}`));
                process.exit(1);
            }

            // Interactive Confirmation
            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Execute this fix?',
                default: false
            }]);

            if (confirm) {
                console.log(chalk.gray(`\nRunning fix: ${suggestedFix}`));
                const fixOutput = await executeSystemCommand(suggestedFix);
                console.log(fixOutput);
                console.log(chalk.green('✅ Fix applied successfully!'));

                if (!isCached) {
                    await memory.store(command, error.message, suggestedFix, { cwd: process.cwd() });
                }
            }
        } catch (aiError) {
            console.error(chalk.red('AI Assistance failed:'), aiError.message);
        }
    }
})();
