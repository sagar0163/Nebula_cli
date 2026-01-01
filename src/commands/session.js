import readline from 'readline';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { executeSystemCommand } from '../utils/executioner.js';
import { AIService } from '../services/ai.service.js';
import SessionContext from '../utils/session-context.js';
import { VectorMemory } from '../services/vector-memory.js';
import { isSafeCommand } from '../utils/safe-guard.js';
import { ContextScrubber } from '../utils/context-scrubber.js';
import { CommandPredictor } from '../services/command-predictor.js';

const fileCompleter = (line) => {
    const cwd = SessionContext.getCwd();
    const args = line.split(/\s+/);
    const lastArg = args[args.length - 1]; // incomplete path

    // Determine directory to search
    let dirToSearch = cwd;
    let partialFile = lastArg;

    if (lastArg.includes('/')) {
        const dir = path.dirname(lastArg);
        dirToSearch = path.resolve(cwd, dir);
        partialFile = path.basename(lastArg);
    }

    try {
        const files = fs.readdirSync(dirToSearch);
        const hits = files.filter((c) => c.startsWith(partialFile));

        // Show all files if no partial match, else show matches
        // Map back to relative path input
        const completions = (hits.length ? hits : files).map(file => {
            if (lastArg.includes('/')) {
                return path.join(path.dirname(lastArg), file);
            }
            return file;
        });

        return [completions, lastArg];
    } catch (err) {
        return [[], lastArg];
    }
};

export const startSession = () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('nebula 🌌> '),
        historySize: 1000,
        completer: fileCompleter
    });

    console.log(chalk.cyan('\n🚀 Nebula Session Started (type `exit` to quit)\n'));
    rl.prompt();

    // Graceful Exit Handling
    rl.on('close', () => {
        console.log(chalk.gray('\n👋 Session ended gracefully.'));
        process.exit(0);
    });

    rl.on('SIGINT', () => {
        console.log(chalk.gray('\n\n👋 Interrupted. Goodbye!'));
        process.exit(0);
    });

    rl.on('line', async (line) => {
        const command = line.trim();

        // Proactive Tip: Every 10 commands
        if (SessionContext.history.length > 0 && SessionContext.history.length % 10 === 0) {
            console.log(chalk.blue('\n💭 Pro tip:'));
            try {
                const prediction = await CommandPredictor.predictNextCommand(SessionContext.getCwd());
                console.log(chalk.gray(`   ${prediction.command}`));
                console.log('');
            } catch (e) { }
        }

        // NEW: Filter prompt leakage
        if (ContextScrubber.isPromptLeakage(command)) {
            console.log(chalk.gray('ℹ Ignored: prompt residue'));
            rl.prompt();
            return;
        }

        // NEW: Loop detection (self-healing spiral)
        if (ContextScrubber.detectLoop(SessionContext.history)) {
            console.log(chalk.yellow('\n🔄 Loop detected. Scrubbing context...\n'));
            await ContextScrubber.emergencyScrub();
            rl.prompt();
            return;
        }

        if (!command) {
            rl.prompt();
            return;
        }

        if (command === 'exit' || command === 'quit') {
            rl.close();
            return;
        }

        if (await handleBuiltins(command, rl)) return;

        try {
            SessionContext.addCommand(command);

            // Execute in current session context
            const stdout = await executeSystemCommand(command, {
                cwd: SessionContext.getCwd(),
            });

            console.log(stdout); // Executioner returns stdout string (promise resolves)
            SessionContext.addResult({ command, success: true });

        } catch (err) {
            // Executioner rejects on non-zero exit code
            console.log(chalk.red(`\n✖ Command failed: ${err.message}`));
            SessionContext.addResult({ command, success: false, stderr: err.message });

            await handleAutoHealing(command, err.message);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log(chalk.gray('\nExiting Nebula Session. Goodbye!\n'));
        process.exit(0);
    });
};

async function handleBuiltins(command, rl) {
    if (command === 'clear') {
        console.clear();
        rl.prompt();
        return true;
    }

    if (command === 'history') {
        SessionContext.printHistory();
        rl.prompt();
        return true;
    }

    if (command.startsWith('cd ')) {
        const target = command.slice(3).trim();
        SessionContext.changeDir(target);
        rl.prompt();
        return true;
    }

    return false;
}

async function handleAutoHealing(command, errorMessage) {
    console.log(chalk.yellow('\n🤖 Nebula is analyzing...'));

    // 1. Vector Cache Check
    const similarFixes = await memory.findSimilar(command, errorMessage);
    if (similarFixes.length > 0) {
        const bestMatch = similarFixes[0];
        const similarity = (bestMatch.similarity * 100).toFixed(1);
        console.log(chalk.green.bold(`\n⚡ Instant Fix (Vector Match: ${similarity}%)`));
        console.log(chalk.bold(`Suggested Fix: ${bestMatch.fix}`));
        await promptAndExecuteFix(bestMatch.fix);
        return;
    }

    // 2. AI Diagnosis
    try {
        const context = {
            os: os.platform(),
            cwd: SessionContext.getCwd(),
            history: SessionContext.getHistoryForRag()
        };

        const diagnosis = await aiService.getFix(errorMessage, command, context);
        const suggestedFix = diagnosis.response;
        const provider = diagnosis.source;

        if (!suggestedFix) {
            console.log(chalk.gray('No clear fix suggested by AI.'));
            return;
        }

        console.log(chalk.cyan(`\n💡 Suggested Fix (${provider}): ${chalk.bold(suggestedFix)}`));

        // Safety Check
        if (!isSafeCommand(suggestedFix)) {
            console.log(chalk.red.bold(`\n⚠️  DANGER: Destructive command detected.`));
            return;
        }

        await promptAndExecuteFix(suggestedFix, command, errorMessage);

    } catch (aiError) {
        console.error(chalk.red('AI Assistance failed:'), aiError.message);
    }
}

async function promptAndExecuteFix(fix, originalCommand, originalError) {
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Execute this fix?',
        default: false,
    }]);

    if (confirm) {
        console.log(chalk.gray(`\nRunning fix: ${fix}`));
        try {
            const stdout = await executeSystemCommand(fix, { cwd: SessionContext.getCwd() });
            console.log(stdout);
            console.log(chalk.green('✅ Fix applied successfully!'));
            SessionContext.addResult({ command: fix, success: true });

            // Cache successful fix logic
            if (originalCommand && originalError) {
                await memory.store(originalCommand, originalError, fix, { cwd: SessionContext.getCwd() });
            }
        } catch (err) {
            console.log(chalk.red(`\n❌ Fix failed: ${err.message}`));
            SessionContext.addResult({ command: fix, success: false, stderr: err.message });
        }
    } else {
        console.log(chalk.gray('Skipped.'));
    }
}
