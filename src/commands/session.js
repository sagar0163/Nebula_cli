import readline from 'readline';
import chalk from 'chalk';
import { executeSystemCommand } from '../utils/executioner.js';
import { AIService } from '../services/ai.service.js';
import NamespacedVectorMemory from '../services/namespaced-memory.js';
import { ContextScrubber } from '../utils/context-scrubber.js';
import SessionContext from '../utils/session-context.js';
import { UniversalPredictor } from '../services/universal-predictor.js';
import process from 'process';
import os from 'os';

const aiService = new AIService();
const memory = new NamespacedVectorMemory();

// CRITICAL: Global error handler
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('⚠️ Unhandled promise:', reason));
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('⚠️ Uncaught exception:', error.message));
});

const NEBULA_COMMANDS = {
    predict: async () => {
        const { CommandPredictor } = await import('../utils/project-scanner.js');
        const pred = await CommandPredictor.predictNextCommand(SessionContext.getCwd());
        console.log(chalk.green(`Suggestion: ${pred.command}`));
        return pred;
    },

    ask: async (fullCommand) => {
        const question = fullCommand.slice(4).trim();
        const { ProjectAnalyzer } = await import('../services/project-analyzer.js');
        return ProjectAnalyzer.ask(question);
    },

    memory: () => {
        const history = SessionContext.getHistory().slice(-10);
        console.log(chalk.blue('\n🧠 Session Memory (Last 10):'));
        history.forEach((h, i) => console.log(`${i + 1}. ${h}`));
        return history;
    },

    status: async () => {
        // User wanted ProjectID.getOrCreateUID
        const { ProjectID } = await import('../utils/project-id.js');
        const status = {
            cwd: SessionContext.getCwd(),
            project: await ProjectID.getOrCreateUID(SessionContext.getCwd())
        };
        console.log(chalk.cyan(`\n📍 CWD: ${status.cwd}`));
        console.log(chalk.gray(`🆔 Project ID: ${status.project}`));
        return status;
    },

    help: () => {
        console.log(chalk.bold('\n🌌 Nebula Hybrid Shell (v4.6)'));
        console.log(`
${chalk.cyan('Nebula Commands:')}
  predict       Scan project → Next command
  ask <query>   "deploy Tyk?" → Step-by-step plan
  memory        Show recent commands
  status        Current project context
  exit          Close session

${chalk.cyan('Shell Commands:')}
  <any>         Runs as normal (ls, cd, kubectl, etc.)
`);
    }
};

export const startSession = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'nebula 🌌> ',
        historySize: 1000,
    });

    console.log(chalk.cyan('\n🚀 Nebula v4.6 Session (Hybrid Shell)\n'));

    await memory.initialize(SessionContext.getCwd());

    rl.prompt();

    rl.on('line', async (line) => {
        const command = line.trim();
        if (!command) { rl.prompt(); return; }

        if (ContextScrubber.isPromptLeakage(command)) {
            rl.prompt();
            return;
        }

        const parts = command.split(/\s+/);
        const nebulaCmd = parts[0].toLowerCase();

        if (nebulaCmd === 'exit') {
            rl.close();
            return;
        }

        if (nebulaCmd === 'clear') {
            console.clear();
            rl.prompt();
            return;
        }

        if (nebulaCmd === 'cd') {
            const targetDir = parts.slice(1).join(' ');
            try {
                process.chdir(targetDir || os.homedir());
                SessionContext.setCwd(process.cwd());
                await memory.initialize(process.cwd());
                console.log(chalk.gray(`📂 ${process.cwd()}`));
            } catch (e) {
                console.log(chalk.red(`cd: ${e.message}`));
            }
            rl.prompt();
            return;
        }

        // 1. NEBULA COMMANDS
        if (NEBULA_COMMANDS[nebulaCmd]) {
            rl.pause(); // <--- FIX: Pause readline to prevent input leakage during async ops (inquirer)
            try {
                // Pass full command line for args parsing
                await NEBULA_COMMANDS[nebulaCmd](command);
            } catch (e) {
                console.log(chalk.yellow('❓'), e.message);
            } finally {
                rl.resume(); // <--- FIX: Resume readline after command completes
                rl.prompt();
            }
            return;
        }

        // 2. SHELL COMMANDS
        // TIMEOUT WRAPPER
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Command timeout (10s)')), 10000)
        );

        rl.pause();
        try {
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
                // Handle Auto Healing
                console.log(chalk.red(`❌ Exit ${result.exitCode || 1}`));
                console.log(chalk.red(result.stderr || 'Unknown error'));
                SessionContext.addResult({ success: false, stderr: result.stderr });
                await handleAutoHealingSafe(command, result, rl);
            }
        } catch (error) {
            console.log(chalk.red('⚠️'), error.message);
        } finally {
            rl.resume();
            rl.setPrompt('nebula 🌌> ');
            rl.prompt();
        }
    });

    process.on('SIGINT', () => {
        console.log(chalk.gray('\n👋 Interrupted gracefully'));
        rl.close();
    });

    rl.on('close', () => {
        console.log(chalk.gray('Session closed'));
        process.exit(0);
    });
};

async function handleAutoHealingSafe(command, result, rl) {
    try {
        const errorMsg = result.stderr || 'Unknown error';

        // 1. Vector Cache Check
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

            await memory.store(command, errorMsg, diagnosis.response, { cwd: SessionContext.getCwd() });
        }
    } catch (error) {
        console.log(chalk.gray('Healing skipped:', error.message));
    }
}
