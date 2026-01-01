import readline from 'readline';
import chalk from 'chalk';
import { executeSystemCommand } from '../utils/executioner.js';
import { AIService } from '../services/ai.service.js';
import NamespacedVectorMemory from '../services/namespaced-memory.js';
import { ContextScrubber } from '../utils/context-scrubber.js';
import SessionContext from '../utils/session-context.js';
import { UniversalPredictor } from '../services/universal-predictor.js';
import process from 'process';

const aiService = new AIService();
const memory = new NamespacedVectorMemory();
// Initialize memory ASAP - but startSession is where we have context?
// Actually we should initialize it inside startSession or just before loop.
// But startSession export is clean. We can init it lazily or at start.
// Given we might change dirs, let's keep it singleton but re-init?
// The user code initialized it inside startSession: `const memory = ...; await memory.initialize...`
// So I will follow that pattern inside startSession.

// CRITICAL: Global error handler
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('⚠️ Unhandled promise:', reason));
    // NEVER EXIT - Log and continue
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('⚠️ Uncaught exception:', error.message));
    // NEVER EXIT
});

export const startSession = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'nebula 🌌> ',
        historySize: 1000,
    });

    console.log(chalk.cyan('\n🚀 Nebula v4.3 Session (Project-Isolated)\n'));

    // Initialize Memory for current Project
    await memory.initialize(SessionContext.getCwd());

    rl.prompt();

    rl.on('line', async (line) => {
        const command = line.trim();
        if (!command) {
            rl.prompt();
            return;
        }

        // Input filter
        if (ContextScrubber.isPromptLeakage(command)) {
            rl.prompt();
            return;
        }

        // Builtins
        if (await handleBuiltins(command, rl)) {
            return;
        }

        // TIMEOUT WRAPPER (10s max)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Command timeout (10s)')), 10000)
        );

        rl.pause(); // PAUSE
        try {
            // Execute command
            const executionPromise = (async () => {
                try {
                    const output = await executeSystemCommand(command, { cwd: SessionContext.getCwd() });
                    return { success: true, stdout: output };
                } catch (err) {
                    return { success: false, stderr: err.message, exitCode: err.code || 1 };
                }
            })();

            const result = await Promise.race([
                executionPromise,
                timeoutPromise
            ]);

            if (result.success) {
                process.stdout.write(result.stdout || '');
                SessionContext.addResult({ success: true, output: result.stdout });
            } else {
                console.log(chalk.red(`❌ Exit ${result.exitCode || 1}`));
                console.log(chalk.red(result.stderr || 'Unknown error'));
                SessionContext.addResult({ success: false, stderr: result.stderr });
                await handleAutoHealingSafe(command, result, rl); // Pass RL
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️ ${error.message}`));
        } finally {
            rl.resume(); // RESUME
            rl.setPrompt('nebula 🌌> ');
            rl.prompt();
        }
    });

    // Graceful signals
    process.on('SIGINT', () => {
        console.log(chalk.gray('\n👋 Interrupted gracefully'));
        rl.close();
    });

    rl.on('close', () => {
        console.log(chalk.gray('Session closed'));
        process.exit(0);
    });
};

// Helper for builtins
async function handleBuiltins(command, rl) {
    if (command === 'exit') {
        rl.close();
        return true;
    }
    if (command === 'clear') {
        console.clear();
        rl.prompt();
        return true;
    }
    if (command === 'history') {
        console.log(SessionContext.getHistory().join('\n'));
        rl.prompt();
        return true;
    }
    if (command === 'predict') {
        process.env.NEBULA_SESSION = 'true';
        try {
            // Need dynamic import if not top-level or just use imported class
            // Since we imported UniversalPredictor, we can use it directly?
            // Wait, import might have side effects or be heavy? No, class is fine.
            // But we want to simulate the 'predict' command flow.

            const inquirer = (await import('inquirer')).default;

            console.log(chalk.blue('\n🔮 Gazing into the directory...'));
            // Use current session CWD
            const prediction = await UniversalPredictor.predict(SessionContext.getCwd());

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
                    const output = await executeSystemCommand(prediction.command, { cwd: SessionContext.getCwd() });
                    console.log(output);
                    await UniversalPredictor.learn(SessionContext.getCwd(), prediction.command);
                } catch (e) {
                    console.log(chalk.yellow(`Execution failed: ${e.message}`));
                }
            }
        } catch (e) {
            console.log(chalk.red(`Predict failed: ${e.message}`));
        }
        delete process.env.NEBULA_SESSION;
        rl.prompt(); // Ensure prompt returns
        return true;
    }

    // Check for directory navigation (cd)
    if (command.startsWith('cd ')) {
        const targetDir = command.substring(3).trim();
        try {
            // Must change process.cwd() for valid relative path resolution
            process.chdir(targetDir);
            SessionContext.setCwd(process.cwd());
            console.log(chalk.gray(`📂 ${process.cwd()}`));
            // Re-initialize memory for new project context
            await memory.initialize(process.cwd());
        } catch (e) {
            console.log(chalk.red(`cd: ${e.message}`));
        }
        rl.prompt();
        return true;
    }

    return false;
}

async function handleAutoHealingSafe(command, result) {
    try {
        const errorMsg = result.stderr || 'Unknown error';

        // 1. Vector Cache Check with Timeout
        const similar = await Promise.race([
            memory.findSimilar(command, errorMsg),
            new Promise(r => setTimeout(() => r([]), 3000))
        ]);

        if (similar && similar.length > 0) {
            console.log(chalk.green(`\n⚡ Instant Fix (Memory ${Math.round(similar[0].similarity * 100)}%):`));
            console.log(chalk.bold(similar[0].fix));

            const inquirer = (await import('inquirer')).default;
            const { confirm } = await inquirer.prompt([{
                type: 'confirm', name: 'confirm', message: 'Execute?', default: true
            }]);

            if (confirm) {
                const output = await executeSystemCommand(similar[0].fix, { cwd: SessionContext.getCwd() });
                console.log(output);
            }
            return;
        }

        // 2. AI Diagnosis
        const diagnosis = await Promise.race([
            aiService.getFix(errorMsg, command, {
                os: process.platform,
                cwd: SessionContext.getCwd(),
                task: 'fix_command'
            }),
            new Promise(r => setTimeout(() => r({ response: 'No fix available' }), 5000))
        ]);

        if (!diagnosis || !diagnosis.response || diagnosis.response === 'No fix available') {
            console.log(chalk.gray('No AI fix available (timeout).'));
            return;
        }

        console.log(chalk.cyan(`\n💡 Suggested Fix: ${chalk.bold(diagnosis.response)}`));

        const inquirer = (await import('inquirer')).default;
        const { confirm } = await inquirer.prompt([{
            type: 'confirm', name: 'confirm', message: 'Execute?', default: false
        }]);

        if (confirm) {
            const output = await executeSystemCommand(diagnosis.response, { cwd: SessionContext.getCwd() });
            console.log(output);

            // Learn fix
            await memory.store(command, errorMsg, diagnosis.response, { cwd: SessionContext.getCwd() });
        }
    } catch (error) {
        console.log(chalk.gray('Healing skipped:', error.message));
    }
}
