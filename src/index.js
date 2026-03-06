#!/usr/bin/env node

import './utils/env-loader.js'; // Must be first
import { executeSystemCommand } from './utils/executioner.js';
import { AIService } from './services/ai.service.js';
import NamespacedVectorMemory from './services/namespaced-memory.js';
import { isSafeCommand } from './utils/safe-guard.js';
import { startSession } from './commands/session.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import os from 'os';
import { execSync } from 'child_process';
import pino from 'pino';

// Initialize structured logger
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { colorize: true }
    } : undefined
});

// Global error handlers for stability
process.on('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught Exception');
    console.error(chalk.red('💥 Fatal Error:'), error.message);
    console.error(chalk.gray('Run with LOG_LEVEL=debug for more info.'));
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason }, 'Unhandled Rejection');
    console.error(chalk.red('💥 Unhandled Promise Rejection:'), reason);
    process.exit(1);
});

// CLI Flag Parser
const args = process.argv.slice(2);
const flags = {
  verbose: false,
  quiet: false,
  config: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    flags.verbose = true;
  } else if (args[i] === '--quiet' || args[i] === '-q') {
    flags.quiet = true;
  } else if (args[i] === '--config' || args[i] === '-c') {
    flags.config = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
🌌 Nebula-CLI Options:
  -v, --verbose    Enable verbose logging
  -q, --quiet      Suppress non-essential output
  -c, --config     Specify custom config file
  -h, --help       Show this help message
            `);
    process.exit(0);
  } else if (args[i].startsWith('-')) {
    // Unknown flag
    console.error(chalk.red(`Error: Unknown flag '${args[i]}'`));
    console.error(chalk.gray(`Run 'nebula --help' for available options.`));
    process.exit(1);
  }
}

// Validate config file if provided
if (flags.config) {
  const fs = await import('fs');
  if (!fs.existsSync(flags.config)) {
    console.error(chalk.red(`Error: Config file not found: ${flags.config}`));
    process.exit(1);
  }
}

// Export flags for use in other modules
export { flags, logger };

// Filter out flags from args for command processing
const commandArgs = args.filter(arg => 
  !arg.startsWith('--') && !arg.startsWith('-') || 
  (arg !== '--verbose' && arg !== '-v' && arg !== '--quiet' && arg !== '-q' && arg !== '--config' && arg !== '-c' && arg !== '--help' && arg !== '-h')
);

// Remove flag values from commandArgs
const cleanedArgs = [];
for (let i = 0; i < commandArgs.length; i++) {
  const arg = commandArgs[i];
  if ((arg === '--config' || arg === '-c') && commandArgs[i + 1] && !commandArgs[i + 1].startsWith('-')) {
    i++; // skip the value
    continue;
  }
  cleanedArgs.push(arg);
}

if (!flags.quiet) {
  console.log(chalk.cyan.bold('Nebula-CLI: The Self-Healing Terminal Agent'));
}

const aiService = new AIService();
const memory = new NamespacedVectorMemory();

import { dynamicNebula } from './dynamic-transparency.js';

(async () => {
    // 🔥 v5.2.1 Dynamic Startup
    // Only run if interactive (no args) or specifically requested
    if ((cleanedArgs.length === 0 || cleanedArgs[0] === 'session') && !process.env.SKIP_INTRO) {
        await dynamicNebula.dynamicStartup(process.cwd());
    }

    // 1. Nebula Predict Mode
    if (cleanedArgs[0] === 'predict') {
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
    if (cleanedArgs[0] === 'release') {
        try {
            // Let release-it handle the semantic versioning and changelog
            console.log(chalk.cyan(`🚀 Launching interactive release...`));

            const { executeSystemCommand } = await import('./utils/executioner.js');
            // Execute npm run release (interactive)
            // Note: We use stdio inheritance in executioner usually, but let's ensure it supports input if needed.
            // Actually executioner uses 'inherit' for stdio, so interactive prompts from release-it should work.
            const releaseOutput = await executeSystemCommand('npm run release', { timeout: 600000 }); // 10 min timeout

            console.log(releaseOutput);
            console.log(chalk.green('✅ Branch created, version updated, and pushed to origin!'));
        } catch (e) {
            console.log(chalk.red(`❌ Release failed: ${e.message}`));
        }
        return;
    }

    // 3. Ask Mode
    if (cleanedArgs[0] === 'ask') {
        const question = args.slice(1).join(' ');
        if (!question) {
            console.log(chalk.yellow('Usage: nebula ask "your question"'));
            return;
        }
        const { ProjectAnalyzer } = await import('./services/project-analyzer.js');
        await ProjectAnalyzer.ask(question);
        return;
    }

    // New: Chat Mode (Planning/Design)
    if (cleanedArgs[0] === 'chat') {
        const prompt = args.slice(1).join(' ');
        if (!prompt) {
            console.log(chalk.yellow('Usage: nebula chat "your prompt"'));
            return;
        }
        console.log(chalk.blue('\n🧠 Thinking...\n'));
        const response = await aiService.getChat(prompt);
        console.log(chalk.yellow('⚠️  Untrusted Output. Review commands before running.\n'));
        console.log(chalk.cyan(`💬 RESPONSE:\n${response.response}`));
        console.log(chalk.gray(`\n[Source: ${response.source}]`));
        return;
    }

    // 4. Status Mode
    if (cleanedArgs[0] === 'status') {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const pkg = require('../package.json');

        console.log(chalk.bold('\n🌌 Nebula Status Dashboard'));
        console.log(chalk.gray('--------------------------------'));
        console.log(`📦 Version:     ${chalk.green(pkg.version)}`);
        console.log(`🛡️  Security:    ${chalk.green('Hardened (v5.4)')}`);
        console.log(`🧠 Mode:        ${process.env.TRAINING_MODE === 'true' ? chalk.magenta('TRAINING (HF Space)') : chalk.cyan('NORMAL (Smart Failover)')}`);

        // 🔥 Dynamic Transparency Integration
        const { dynamicNebula } = await import('./dynamic-transparency.js');
        await dynamicNebula.autoDiscoverPatterns(process.cwd());
        console.log(`🧬 Dynamic DNA: [${Array.from(dynamicNebula.dynamicPatterns.keys()).join(', ')}]`);

        // Project ID Check
        const { ProjectID } = await import('./utils/project-id.js');
        const pid = await ProjectID.getOrCreateUID(process.cwd());
        console.log(`📂 Project ID:  ${chalk.blue(pid)}`);
        console.log(chalk.gray('--------------------------------\n'));
        return;
    }

    // 5. Watch Mode
    if (cleanedArgs[0] === 'watch') {
        const { WatchMode } = await import('./utils/watch-mode.js');
        
        const watchOptions = {
            path: process.cwd(),
            autoFix: cleanedArgs.includes('--fix') || cleanedArgs.includes('-f'),
            extensions: ['.js', '.ts', '.json', '.yaml', '.yml'],
            debounce: 2000
        };

        console.log(chalk.cyan('\n👀 Starting watch mode...\n'));
        
        const watcher = new WatchMode(watchOptions);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            watcher.stop();
            process.exit(0);
        });
        
        await watcher.start();
        return;
    }

    // 5. Help Mode
    if (cleanedArgs[0] === 'help' || cleanedArgs[0] === '--help' || cleanedArgs[0] === '-h') {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const pkg = require('../package.json');

        console.log(chalk.bold(`\n🌌 Nebula-CLI v${pkg.version}`));
        console.log(chalk.gray('The Self-Healing Terminal Agent'));

        console.log(`
${chalk.cyan('Usage:')}
  nebula [command]

${chalk.cyan('Commands:')}
  session       Start interactive hybrid shell (Default)
  ask <query>   "deploy Tyk?" → Step-by-step plan
  chat <prompt> "Explain this code" → LLM response
  predict       Scan project → Predict next move
  watch         Watch files and auto-fix issues
  release       Interactive semantic release
  status        Show project context & DNA
  efficiency    Show token currency audit
  help          Show this screen
`);
        return;
    }

    // 5. Interactive Session Mode
    if (cleanedArgs.length === 0 || cleanedArgs[0] === 'session') {
        startSession();
        return;
    }

    // 3. One-Shot Command Mode
    const command = args.join(' ');
    try {
        await memory.initialize(process.cwd()); // Initialize Project Memory
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

            // console.log('DEBUG MSG:', error.message); // Debugging exact error string
            const similarFixes = await memory.findSimilar(command, error.message);

            if (similarFixes.length > 0) {
                const bestMatch = similarFixes[0];
                if (bestMatch.fix && bestMatch.fix.trim().length > 0) {
                    suggestedFix = bestMatch.fix;
                    const similarity = (bestMatch.similarity * 100).toFixed(1);
                    console.log(chalk.green.bold(`\n⚡ Instant Fix (Vector Match: ${similarity}%)`));
                    isCached = true;
                }
            }

            if (!isCached) {
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
