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
        const { ProjectID } = await import('../utils/project-id.js');
        const mem = process.memoryUsage();
        const status = {
            cwd: SessionContext.getCwd(),
            project: await ProjectID.getOrCreateUID(SessionContext.getCwd()),
            rss: Math.round(mem.rss / 1024 / 1024),
            heap: Math.round(mem.heapUsed / 1024 / 1024)
        };
        console.log(chalk.cyan(`\n📍 CWD: ${status.cwd}`));
        console.log(chalk.gray(`🆔 Project ID: ${status.project}`));
        console.log(chalk.yellow(`💾 Memory: ${status.rss}MB (RSS) | ${status.heap}MB (Heap)`));
        console.log(chalk.gray(`⌚ Uptime: ${Math.floor(process.uptime())}s`));
        return status;
    },

    help: () => {
        console.log(chalk.bold(`\n🌌 Nebula Hybrid Shell (v${pkg.version})`));
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

/**
 * -------------------------------------------------------------
 * CORE SESSION LOOP: Leak-Proof Architecture
 * -------------------------------------------------------------
 * Instead of a persistent readline interface that might capture
 * buffered input during async operations (Inquirer), we use
 * a strict "Create -> Ask -> Close" lifecycle for every command.
 * This guarantees zero cross-talk between the prompt and sub-processes.
 * -------------------------------------------------------------
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

export const startSession = async () => {
    console.log(chalk.cyan(`\n🚀 Nebula v${pkg.version} Session (Hybrid Shell)\n`));
    await memory.initialize(SessionContext.getCwd());
    await SessionContext.initialize(SessionContext.getCwd());

    let sessionHistory = [];

    while (true) {
        // 1. Create fresh Interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'nebula 🌌> ',
            history: sessionHistory, // Persist history manually
            historySize: 1000,
            removeHistoryDuplicates: true
        });

        // 2. Wait for ONE line
        const line = await new Promise(resolve => {
            rl.prompt();
            rl.once('line', (input) => {
                rl.close(); // IMMEDIATE CLOSE to stop buffering
                resolve(input);
            });

            // Handle Ctrl+C during prompt
            rl.once('SIGINT', () => {
                rl.close();
                console.log(chalk.gray('\nWait... (Press Ctrl+D to exit)'));
                resolve(''); // resolve empty to loop again
            });
        });

        // 3. Persist History (Readline mutates the array we passed, but let's be safe)
        // Actually readline instance maintains its own history. We need to grab it back.
        // Or simpler: just let readline manage it if we pass the SAME array instance?
        // Node's readline modifies the array passed in `history`. 
        // We just ensure we keep the reference.
        // (No action needed if we passed `sessionHistory` reference)

        if (line === null) break; // EOF

        const command = line.trim();
        if (!command) continue;

        if (command === 'exit') {
            console.log(chalk.gray('Session closed'));
            process.exit(0);
        }

        if (command === 'clear') {
            console.clear();
            continue;
        }

        // 4. Process Command (RL is DEAD here, stdin is free for Inquirer)
        await processCommand(command);
    }
};

async function processCommand(command) {
    if (ContextScrubber.isPromptLeakage(command)) return;

    const parts = command.split(/\s+/);
    const nebulaCmd = parts[0].toLowerCase();

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
        return;
    }

    if (NEBULA_COMMANDS[nebulaCmd]) {
        try {
            await NEBULA_COMMANDS[nebulaCmd](command);
        } catch (e) {
            // console.log(e); 
            // Inquirer errors or logic errors
            console.log(chalk.yellow('❓'), e.message);
        }
        return;
    }

    // Shell Command
    // Timeout is now handled dynamically by executeSystemCommand based on command type
    try {
        SessionContext.addCommand(command); // CRITICAL: Record command for history/AI context

        const result = await executeSystemCommand(command, { cwd: SessionContext.getCwd() })
            .then(out => ({ success: true, stdout: out }))
            .catch(err => ({ success: false, stderr: err.message, exitCode: 1 }));

        if (result.success) {
            process.stdout.write(result.stdout || '');
            SessionContext.addResult({ success: true, output: result.stdout });
        } else {
            console.log(chalk.red(`❌ Exit ${result.exitCode || 1}`));
            console.log(chalk.red(result.stderr || 'Unknown error'));
            SessionContext.addResult({ success: false, stderr: result.stderr });
            await handleAutoHealingSafe(command, result);
        }
    } catch (error) {
        console.log(chalk.red('⚠️'), error.message);
    }
}

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

        // 1.5. Heuristic: YAML Parsing Issues (Missing Tool)
        if ((errorMsg.toLowerCase().includes('yaml') || errorMsg.toLowerCase().includes('parsing')) && !errorMsg.includes('yq')) {
            try {
                // Check if yq exists
                await executeSystemCommand('which yq', { cwd: SessionContext.getCwd(), silent: true });
            } catch (e) {
                // yq likely missing
                const heuristicFix = 'sudo snap install yq';
                console.log(chalk.cyan(`\n💡 Suggested Fix (Heuristic): ${chalk.bold(heuristicFix)}`));
                const inquirer = (await import('inquirer')).default;
                const { confirm } = await inquirer.prompt([{
                    type: 'confirm', name: 'confirm', message: 'Execute?', default: true
                }]);
                if (confirm) {
                    await executeSystemCommand(heuristicFix, { cwd: SessionContext.getCwd() });
                }
                return;
            }
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
