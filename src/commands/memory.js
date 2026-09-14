import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import { getMemoryStats, listMemory, detectPatterns, exportMemory, importMemory, forgetMemory } from '../services/memory-store.js';

export async function runMemoryCommand(args = [], projectUUID) {
  const subcmd = args[0];

  switch (subcmd) {
    case 'list':
    case 'show':
      return handleList(projectUUID);
    case 'stats':
      return handleStats();
    case 'patterns':
      return handlePatterns(projectUUID);
    case 'export':
      return handleExport(args.slice(1));
    case 'import':
      return handleImport(args.slice(1));
    case 'forget':
      return handleForget(args.slice(1));
    default:
      return handleList(projectUUID);
  }
}

async function handleList(projectUUID) {
  const stats = getMemoryStats();
  const entries = listMemory(projectUUID, 15);

  console.log(chalk.bold('\n🧠 Nebula Memory'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.white(`  Projects tracked:  `) + chalk.cyan(stats.projects));
  console.log(chalk.white(`  Project fixes:     `) + chalk.cyan(stats.projectFixes));
  console.log(chalk.white(`  Global fixes:      `) + chalk.cyan(stats.globalFixes));
  console.log(chalk.white(`  Vector fixes:      `) + chalk.cyan(stats.vectorFixes));
  console.log(chalk.white(`  Encryption:        `) + (stats.encryption ? chalk.green('ON') : chalk.yellow('OFF')));
  console.log(chalk.white(`  Local-only:        `) + (stats.localOnly ? chalk.green('YES') : chalk.yellow('Sync enabled')));
  console.log(chalk.gray('='.repeat(50)));

  if (entries.length === 0) {
    console.log(chalk.yellow('\n  No memories recorded yet. Nebula learns as you use it.'));
    return;
  }

  console.log(chalk.bold('\n  Recent memories:\n'));

  for (const [i, entry] of entries.entries()) {
    const num = (i + 1).toString().padStart(2);
    const tier = entry.tier === 'vector' ? chalk.magenta('vector') :
      entry.tier === 'global' ? chalk.blue('global') : chalk.green('project');
    const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '';

    console.log(chalk.gray(`  ${num}.`) + ` [${tier}] ` + chalk.white(entry.command || '(no command)'));
    if (entry.fix) {
      console.log(chalk.gray(`      → `) + chalk.green(entry.fix.slice(0, 80)));
    }
    if (ts) {
      console.log(chalk.gray(`      ${ts}`));
    }
    console.log('');
  }
}

async function handleStats() {
  const stats = getMemoryStats();

  console.log(chalk.bold('\n📊 Memory Statistics'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.white(`  Projects tracked:     `) + chalk.cyan(stats.projects));
  console.log(chalk.white(`  Project fix entries:  `) + chalk.cyan(stats.projectFixes));
  console.log(chalk.white(`  Global fix entries:   `) + chalk.cyan(stats.globalFixes));
  console.log(chalk.white(`  Vector fix entries:   `) + chalk.cyan(stats.vectorFixes));
  console.log(chalk.white(`  Total entries:        `) + chalk.bold.cyan(stats.projectFixes + stats.globalFixes + stats.vectorFixes));
  console.log('');
  console.log(chalk.white(`  Encryption at rest:   `) + (stats.encryption ? chalk.green('ENABLED (AES-256-GCM)') : chalk.red('DISABLED')));
  console.log(chalk.white(`  Cloud sync:           `) + (stats.localOnly ? chalk.green('DISABLED (local-first)') : chalk.yellow('ENABLED')));
  console.log('');
  console.log(chalk.gray('  Config via: NEBULA_MEMORY_ENCRYPTION, NEBULA_MEMORY_SYNC'));
  console.log(chalk.gray('='.repeat(50)));
}

async function handlePatterns(projectUUID) {
  const suggestions = detectPatterns(projectUUID);

  console.log(chalk.bold('\n🔍 Detected Patterns'));
  console.log(chalk.gray('='.repeat(50)));

  if (suggestions.length === 0) {
    console.log(chalk.yellow('  No repeated patterns detected yet. Keep using Nebula to build patterns.'));
  } else {
    for (const s of suggestions) {
      console.log(chalk.white(`  • `) + chalk.cyan(s.command.slice(0, 60)));
      console.log(chalk.green(`    → ${s.message}`));
    }
  }

  console.log(chalk.gray('\n  Patterns are detected after you fix the same error ≥ 5 times.'));
  console.log(chalk.gray('='.repeat(50)));
}

async function handleExport(args) {
  const filePath = args[0];

  if (!filePath) {
    console.log(chalk.yellow('Usage: nebula memory export <path>'));
    return;
  }

  try {
    const result = exportMemory(filePath);
    console.log(chalk.green(`\n✔ Memory exported to ${result.file}`));
    console.log(chalk.gray(`  Projects: ${result.projects} | Fixes: ${result.fixes}`));
  } catch (err) {
    console.log(chalk.red(`Export failed: ${err.message}`));
  }
}

async function handleImport(args) {
  const filePath = args[0];

  if (!filePath) {
    console.log(chalk.yellow('Usage: nebula memory import <path>'));
    return;
  }

  try {
    const { overwrite } = await inquirer.prompt([{
      type: 'list',
      name: 'overwrite',
      message: 'Merge with existing memory or overwrite?',
      choices: [
        { name: 'Merge (combine with existing)', value: false },
        { name: 'Overwrite (replace all)', value: true },
      ],
    }]);

    const result = importMemory(filePath, overwrite);
    console.log(chalk.green(`\n✔ Memory imported successfully (${overwrite ? 'overwrite' : 'merge'} mode)`));
  } catch (err) {
    console.log(chalk.red(`Import failed: ${err.message}`));
  }
}

async function handleForget(args) {
  const target = args.join(' ');

  if (!target) {
    console.log(chalk.yellow('Usage: nebula memory forget <id-or-command>'));
    console.log(chalk.gray('Run "nebula memory" to see available IDs.'));
    return;
  }

  try {
    const result = forgetMemory(target);
    if (result.deleted === 0) {
      console.log(chalk.yellow(`No memories found matching "${target}"`));
    } else {
      console.log(chalk.green(`✔ Forgot ${result.deleted} memory(ies) matching "${target}"`));
    }
  } catch (err) {
    console.log(chalk.red(`Forget failed: ${err.message}`));
  }
}

export function getMemoryHelp() {
  return `
  nebula memory              Show learned memories and stats
  nebula memory list         List recent memory entries
  nebula memory stats        Show memory statistics
  nebula memory patterns     Show detected usage patterns
  nebula memory export <f>   Export memory to JSON file
  nebula memory import <f>   Import memory from JSON file
  nebula memory forget <id>  Remove a memory entry`;
}
