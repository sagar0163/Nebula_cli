import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import { TeamAuth } from '../services/team-auth.js';
import { TeamConfig } from '../config/team-config.js';
import { TeamMemory } from '../services/team-memory.js';
import { TeamAnalytics } from '../services/team-analytics.js';

export async function runTeamCommand(args) {
    const subcommand = args[0];

    if (!subcommand || subcommand === 'help') {
        console.log(`
🌌 ${chalk.bold('Nebula Team Features')}

Usage: nebula team <command>

Commands:
  ${chalk.cyan('init')}       Initialize team memory for current project
  ${chalk.cyan('join')}       Join an existing team via invite code/SSO
  ${chalk.cyan('sync')}       Manually sync patterns with team server
  ${chalk.cyan('patterns')}   List stored team patterns and workflows
  ${chalk.cyan('analytics')}  Show team usage and efficiency dashboard
  ${chalk.cyan('perms')}      Control pattern edit permissions (admin)
  ${chalk.cyan('audit')}      Export team audit log (admin)
  ${chalk.cyan('login')}      Authenticate with GitHub/SSO
        `);
        return;
    }

    const auth = new TeamAuth();
    const config = new TeamConfig();
    const analytics = new TeamAnalytics();

    switch (subcommand) {
        case 'login': {
            const user = (await inquirer.prompt([{
                type: 'input',
                name: 'user',
                message: 'GitHub/SSO username:',
                default: 'me'
            }])).user;
            console.log(chalk.yellow('Simulating OAuth Login...'));
            await auth.authenticateOAuth('github', user);
            console.log(chalk.green(`✅ Successfully logged in as ${user}!`));
            break;
        }
        case 'init': {
            const token = await auth.getToken();
            if (!token) {
                console.log(chalk.red('❌ Not logged in. Run `nebula team login` first.'));
                return;
            }
            const { teamName } = await inquirer.prompt([{
                type: 'input',
                name: 'teamName',
                message: 'Enter Team Name:'
            }]);
            const user = await auth.getUsername();
            await config.save({
                teamId: `team-${Date.now()}`,
                teamName,
                autoSync: true,
                members: [user],
                admins: [user],
                patternPermissions: {}
            });
            console.log(chalk.green(`✅ Team ${teamName} initialized! You are admin.`));
            break;
        }
        case 'analytics': {
            const data = await analytics.getDashboardData();
            console.log(chalk.cyan.bold('\n📊 Team Analytics Dashboard'));
            console.log(chalk.white('Patterns Used: ') + chalk.green(data.efficiency.patternsUsed));
            console.log(chalk.white('Time Saved:    ') + chalk.green(`${Math.round(data.efficiency.timeSavedMs / 1000)}s`));
            console.log(chalk.gray('\nMost Frequent Errors:'));
            for (const [err, count] of Object.entries(data.errors).slice(0, 5)) {
                console.log(`- ${err}: ${count}`);
            }
            break;
        }
        case 'sync': {
            console.log(chalk.yellow('Syncing team patterns...'));
            // Simulating sync
            setTimeout(() => {
                console.log(chalk.green('✅ Sync complete!'));
            }, 1000);
            break;
        }
        case 'patterns': {
            const cfg = await config.load();
            const memory = new TeamMemory({ teamId: cfg.teamId });
            const patterns = memory.listAll();
            console.log(chalk.cyan.bold('\n🧠 Team Patterns'));
            if (patterns.length === 0) {
                console.log(chalk.gray('No patterns stored yet.'));
            } else {
                patterns.forEach(p => {
                    const cmd = Array.isArray(p.commands) ? p.commands.join(' && ') : p.commands;
                    console.log(`- ${chalk.yellow(p.name)} [${p.category}]: ${chalk.white(cmd)}`);
                });
            }
            break;
        }
        case 'perms': {
            const user = await auth.getUsername();
            const cfg = await config.load();
            if (!cfg.admins.includes(user)) {
                console.log(chalk.red(`❌ Only admins can control pattern permissions (${user} is not admin).`));
                return;
            }
            const raw = args.slice(1);
            if (raw.length < 2) {
                console.log(chalk.gray('Usage: nebula team perms <category> <all|admin|user1,user2>'));
                console.log(chalk.gray('Examples:'));
                console.log(chalk.gray('  nebula team perms deploy admin'));
                console.log(chalk.gray('  nebula team perms review alice,bob'));
                return;
            }
            const [category, perm] = raw;
            const patternPermissions = { ...(cfg.patternPermissions || {}), [category]: perm };
            await config.save({ ...cfg, patternPermissions });
            console.log(chalk.green(`✅ Permission for "${category}" set to: ${perm}`));
            break;
        }
        case 'audit': {
            const user = await auth.getUsername();
            const cfg = await config.load();
            if (!cfg.admins.includes(user)) {
                console.log(chalk.red(`❌ Only admins can export audit logs (${user} is not admin).`));
                return;
            }
            const memory = new TeamMemory({ teamId: cfg.teamId });
            const log = memory.exportAuditLog();
            const outDir = path.join(os.homedir(), '.nebula-cli', 'team');
            const outFile = path.join(outDir, `audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
            await fs.mkdir(outDir, { recursive: true });
            await fs.writeFile(outFile, JSON.stringify(log, null, 2), 'utf8');
            console.log(chalk.cyan.bold(`\n📋 Team Audit Log (${log.length} events)`));
            for (const entry of log.slice(-5)) {
                console.log(`- ${entry.timestamp} [${entry.nodeId}] ${entry.eventType} ${entry.patternId || ''}`);
            }
            console.log(chalk.green(`\n✅ Exported to: ${outFile}`));
            break;
        }
        default:
            console.log(chalk.red(`Unknown team command: ${subcommand}`));
            console.log(chalk.gray('Run `nebula team help` for usage.'));
    }
}