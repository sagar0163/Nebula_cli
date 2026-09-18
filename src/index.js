#!/usr/bin/env node

import './utils/env-loader.js'; // Must be first
import { executeSystemCommand, analyzeCommand, requireApproval, ToolRegistry } from './utils/advanced-executioner.js';
import { AIService } from './services/ai.service.js';
import NamespacedVectorMemory from './services/namespaced-memory.js';
import { isSafeCommand } from './utils/safe-guard.js';
import { startSession } from './commands/advanced-session.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import os from 'os';
import { execSync } from 'child_process';
import { registry } from './plugins/registry.js';

// CLI Flag Parser
const args = process.argv.slice(2);
const flags = {
  verbose: false,
  quiet: false,
  config: null,
  dryRun: false,
  persist: false,
  instant: false
};

const isNpx = process.env.npm_config_user_agent?.includes('npx') || 
              process.env.npm_command === 'npx' || 
              process.env._?.endsWith('npx');

flags.instant = isNpx;

// Propagate instant mode to all modules via env var (avoids circular imports)
if (flags.instant) {
    process.env.NEBULA_INSTANT_MODE = '1';
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    flags.verbose = true;
  } else if (args[i] === '--quiet' || args[i] === '-q') {
    flags.quiet = true;
  } else if (args[i] === '--config' || args[i] === '-c') {
    flags.config = args[i + 1];
    i++;
  } else if (args[i] === '--dry-run' || args[i] === '-d') {
    flags.dryRun = true;
  } else if (args[i] === '--persist') {
    flags.persist = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`\n🌌 Nebula-CLI Options:\n  -v, --verbose    Enable verbose logging\n  -q, --quiet      Suppress non-essential output\n  -c, --config     Specify custom config file\n  -d, --dry-run    Run command in dry-run mode (no changes applied)\n  --persist        Persist session to disk (used in instant mode)\n  -h, --help       Show this help message\n            `);
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
export { flags };

// Filter out flags from args for command processing
const KNOWN_FLAGS = ['--verbose', '-v', '--quiet', '-q', '--config', '-c', '--help', '-h', '--dry-run', '-d', '--persist'];
const commandArgs = args.filter(arg =>
  (!arg.startsWith('--') && !arg.startsWith('-')) || !KNOWN_FLAGS.includes(arg)
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

// Instant mode: skip persistent memory, use lightweight in-memory only
const memory = flags.instant ? null : new NamespacedVectorMemory();

import { dynamicNebula } from './dynamic-transparency.js';

// Show one-time instant mode upgrade hint
function showInstantHint() {
  if (flags.instant && !flags.quiet) {
    console.log(chalk.gray('─────────────────────────────────────────────'));
    console.log(chalk.yellow('⚡ Instant Mode — no config needed'));
    console.log(chalk.gray('  Run ') + chalk.cyan('nebula setup') + chalk.gray(' to enable memory, healing patterns & advanced features.'));
    console.log(chalk.gray('─────────────────────────────────────────────\n'));
  }
}

(async () => {
    // Show instant mode hint before first interaction
    showInstantHint();

    // 🔥 v5.2.1 Dynamic Startup
    // Skip heavy startup in instant mode — use lightweight fallback
    if ((cleanedArgs.length === 0 || cleanedArgs[0] === 'session') && !process.env.SKIP_INTRO) {
        if (flags.instant) {
            console.log(chalk.gray('⚡ Lightweight mode — skipping project analysis'));
        } else {
            await dynamicNebula.dynamicStartup(process.cwd());
        }
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
                    await executeSystemCommand(prediction.command, { timeout: 60000, dryRun: flags.dryRun });

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
            const releaseOutput = await executeSystemCommand('npm run release', { timeout: 600000, dryRun: flags.dryRun }); // 10 min timeout

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
        console.log(`🛡️  Security:    ${chalk.green('Hardened (v5.1)')}`);
        console.log(`🧪 Dry-Run:     ${flags.dryRun ? chalk.magenta('ENABLED') : chalk.gray('off')}`);
        console.log(`🧠 Mode:        ${process.env.TRAINING_MODE === 'true' ? chalk.magenta('TRAINING (HF Space)') : chalk.cyan('NORMAL (Smart Failover)')}`);

        // Safety features status
        const { getAuditDir } = await import('./utils/audit-logger.js');
        const { loadSafetyRules } = await import('./utils/safety-rules.js');
        const { listSnapshots } = await import('./utils/rollback.js');
        const { isDockerAvailable } = await import('./services/code-sandbox.js');

        const rules = loadSafetyRules();
        const envName = process.env.NEBULA_ENV || rules.defaultEnvironment;
        const snapCount = listSnapshots().length;
        const dockerStatus = isDockerAvailable();
        const auditDir = getAuditDir();

        console.log(`📋 Safety Env:  ${chalk.cyan(envName)}`);
        console.log(`🔒 Sandbox:     ${dockerStatus ? chalk.green('Docker available') : chalk.gray('Docker unavailable (local fallback)')}`);
        console.log(`📸 Snapshots:   ${snapCount > 0 ? chalk.yellow(`${snapCount} pending`) : chalk.gray('none')}`);
        console.log(`📝 Audit Log:   ${auditDir}`);

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
  setup         Interactive configuration wizard for keys/models
  ask <query>   "deploy Tyk?" → Step-by-step plan
  chat <prompt> "Explain this code" → LLM response
  predict       Scan project → Predict next move
  release       Interactive semantic release
  status        Show project context & DNA
  efficiency    Show token currency audit
  analyze <cmd> Analyze command for risks & PTY needs
  pty <cmd>    Run in PTY mode (vim, htop, ssh)
  run <cmd>    Smart run with auto-PTY detection
  team          Team workflows, patterns, and memory
  plugin        Manage healing plugins (list, scaffold, install, test, docs)
  help          Show this screen
`);
        return;
    }

    // NEW: Analyze Mode
    if (cleanedArgs[0] === 'analyze') {
        const cmd = args.slice(1).join(' ');
        if (!cmd) {
            console.log(chalk.yellow('Usage: nebula analyze "<command>"'));
            return;
        }
        
        const { getSafetyScore: getScore } = await import('./utils/safe-guard.js');
        const analysis = analyzeCommand(cmd);
        const score = getScore(cmd);
        const scoreColor = score >= 80 ? chalk.red : score >= 50 ? chalk.yellow : chalk.green;
        console.log(chalk.bold('\n🔍 Command Analysis:'));
        console.log(chalk.gray('=============================================='));
        console.log(chalk.white('Command:    ') + chalk.cyan(cmd));
        console.log(chalk.white('Safety:     ') + chalk.white(`${scoreColor(score)}/100`));
        console.log(chalk.white('Risk:       ') + (analysis.risk === 'critical' ? chalk.red(analysis.risk) : 
            analysis.risk === 'high' ? chalk.red(analysis.risk) : 
            analysis.risk === 'medium' ? chalk.yellow(analysis.risk) : chalk.green(analysis.risk)));
        if (analysis.message) {
            console.log(chalk.white('Message:    ') + chalk.yellow(analysis.message));
        }
        console.log(chalk.white('PTY Needed: ') + (analysis.needsPty ? chalk.green('Yes') : chalk.gray('No')));
        console.log(chalk.white('Interactive:') + (analysis.interactive ? chalk.green('Yes') : chalk.gray('No')));
        console.log(chalk.gray('==============================================\n'));
        return;
    }

    // Efficiency Mode - Show token currency audit
    if (cleanedArgs[0] === 'efficiency') {
        console.log(chalk.bold('\n⚡ Token Efficiency Report'));
        console.log(chalk.gray('=============================================='));
        
        // Check if there's any token tracking
        const tokenFile = '.nebula_tokens.json';
        const fs = await import('fs');
        
        if (fs.existsSync(tokenFile)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
                console.log(chalk.white('Total Tokens Used:   ') + chalk.cyan(tokenData.total || 0));
                console.log(chalk.white('API Calls:           ') + chalk.cyan(tokenData.calls || 0));
                console.log(chalk.white('Prompt Cache Hits:   ') + chalk.cyan(tokenData.cacheHits || 0));
                console.log(chalk.white('Prompt Cache Rate:   ') + chalk.cyan(tokenData.cacheHitRate || '0.0%'));
                if (tokenData.savings) {
                    console.log(chalk.green('Estimated Savings:   ') + chalk.bold(tokenData.savings));
                }
            } catch (e) {
                console.log(chalk.yellow('Could not parse token file'));
            }
        } else {
            console.log(chalk.yellow('No token tracking data found'));
            console.log(chalk.gray('Run some commands to generate data'));
        }
        
        console.log(chalk.gray('==============================================\n'));
        return;
    }

    // NEW: PTY Mode
    if (cleanedArgs[0] === 'pty') {
        const cmd = args.slice(1).join(' ');
        if (!cmd) {
            console.log(chalk.yellow('Usage: nebula pty "<command>"'));
            console.log(chalk.gray('Run command in PTY mode for interactive apps (vim, htop, ssh, etc.)'));
            return;
        }
        
        console.log(chalk.cyan(`\n🖥️  Running in PTY mode: ${cmd}`));
        console.log(chalk.gray('(Use Ctrl+C to exit interactive mode)\n'));
        
        const { executeWithPty } = await import('./utils/advanced-executioner.js');
        try {
            await executeWithPty(cmd, { resize: true, dryRun: flags.dryRun });
        } catch (err) {
            console.log(chalk.red(`PTY Error: ${err.message}`));
        }
        return;
    }

    // NEW: Run Mode (Smart execution)
    if (cleanedArgs[0] === 'run') {
        const cmd = args.slice(1).join(' ');
        if (!cmd) {
            console.log(chalk.yellow('Usage: nebula run "<command>"'));
            console.log(chalk.gray('Smart run with automatic PTY detection'));
            return;
        }
        
        try {
            const output = await executeSystemCommand(cmd, { dryRun: flags.dryRun });
            if (output) console.log(output);
        } catch (err) {
            console.log(chalk.red(`Error: ${err.message}`));
        }
        return;
    }

    // NEW: Setup Mode
    if (cleanedArgs[0] === 'taxonomy') {
        const { handleTaxonomyCommand } = await import('./commands/taxonomy.js');
        await handleTaxonomyCommand(cleanedArgs.slice(1));
        return;
    }

    if (cleanedArgs[0] === 'setup') {
        const { runSetup } = await import('./commands/setup.js');
        await runSetup();
        return;
    }

// NEW: Team Mode
    if (cleanedArgs[0] === 'team') {
        const { runTeamCommand } = await import('./commands/team.js');
        await runTeamCommand(cleanedArgs.slice(1));
        return;
    }

    // NEW: Plugin Mode
    if (cleanedArgs[0] === 'plugin') {
        const { runPluginCommand } = await import('./commands/plugin.js');
        await runPluginCommand(cleanedArgs.slice(1));
        return;
    }

    // 5. Interactive Session Mode
    if (cleanedArgs.length === 0 || cleanedArgs[0] === 'session') {
        startSession();
        return;
    }

    // 3. One-Shot Command Mode
    const command = cleanedArgs.join(' ');
    try {
        if (memory) await memory.initialize(process.cwd()); // Initialize Project Memory (skipped in instant mode)
        console.log(chalk.gray(`Running: ${command}`));
        if (flags.dryRun) console.log(chalk.yellow('🧪 DRY-RUN MODE: No changes will be made.'));
        const output = await executeSystemCommand(command, { dryRun: flags.dryRun });
        console.log(output);
    } catch (error) {
        console.error(chalk.red('\n✖ Command Failed!'));
        console.error(chalk.red(error.message));

        console.log(chalk.yellow('\n🤖 Nebula is analyzing the failure...'));

        try {
            // 0. Taxonomy Pattern Check
            const { TaxonomySystem } = await import('./services/taxonomy.js');
            const taxonomy = new TaxonomySystem();
            const { fileURLToPath } = await import('url');
            const path = await import('path');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            taxonomy.loadCommunityPatterns(path.join(__dirname, '../data/community-patterns.json'));
            
            const patternMatch = taxonomy.match(command, error.message);
            if (patternMatch) {
                console.log(chalk.green(`\n🛡️ Taxonomy Fix (Confidence ${Math.round(patternMatch.effectiveConfidence * 100)}%):`));
                console.log(chalk.bold(patternMatch.fix));

                const { confirm } = await inquirer.prompt([{
                    type: 'confirm', name: 'confirm', message: 'Execute?', default: true
                }]);

                if (confirm) {
                    try {
                        const output = await executeSystemCommand(patternMatch.fix, { cwd: process.cwd(), dryRun: flags.dryRun });
                        console.log(output);
                        taxonomy.updateConfidence(patternMatch.id, true);
                    } catch(e) {
                        console.log(chalk.red(`Fix failed: ${e.message}`));
                        taxonomy.updateConfidence(patternMatch.id, false);
                    }
                }
                return;
            }
            // Check Vector Memory (skipped in instant mode — go straight to AI)
            let suggestedFix;
            let isCached = false;

            if (memory) {
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
            }

            // Plugin healing patterns (sandboxed, community-contributed recipes)
            let pluginHandled = false;
            if (!isCached && !suggestedFix) {
                try {
                    if (registry.plugins.size === 0) registry.loadAll();
                    const pluginPattern = registry.findHealingPattern(error.message);
                    if (pluginPattern) {
                        pluginHandled = true;
                        const action = pluginPattern.heal(error.message);
                        const label = chalk.magenta.bold(`\n🧩 Plugin Fix (${pluginPattern.name})`);
                        if (action && action.action === 'run_command' && action.command) {
                            suggestedFix = action.command;
                            console.log(`${label}: ${action.explanation}`);
                        } else {
                            console.log(`${label}: ${action ? action.explanation : 'No explanation provided.'}`);
                            console.log(chalk.gray('This pattern only informs; no automatic fix is available.'));
                            process.exit(1);
                        }
                    }
                } catch (pluginError) {
                    console.log(chalk.gray(`Plugin engine unavailable: ${pluginError.message}`));
                }
            }

            if (!isCached && !pluginHandled) {
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

            // Safety Check with score display
            const { getSafetyScore } = await import('./utils/safe-guard.js');
            const fixScore = getSafetyScore(suggestedFix);
            const fixScoreColor = fixScore >= 80 ? chalk.red : fixScore >= 50 ? chalk.yellow : chalk.green;
            console.log(chalk.gray(`   Fix Safety Score: ${fixScoreColor(fixScore)}/100`));

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
                const fixOutput = await executeSystemCommand(suggestedFix, { dryRun: flags.dryRun });
                console.log(fixOutput);
                console.log(chalk.green('✅ Fix applied successfully!'));

                if (!isCached && memory) {
                    await memory.store(command, error.message, suggestedFix, { cwd: process.cwd() });
                }
            }
        } catch (aiError) {
            console.error(chalk.red('AI Assistance failed:'), aiError.message);
        }
    }
})();
