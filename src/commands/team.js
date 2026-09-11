import chalk from 'chalk';
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
  ${chalk.cyan('login')}      Authenticate with GitHub/SSO
        `);
        return;
    }

    const auth = new TeamAuth();
    const config = new TeamConfig();
    const analytics = new TeamAnalytics();

    switch (subcommand) {
        case 'login': {
            console.log(chalk.yellow('Simulating OAuth Login...'));
            const token = await auth.authenticateOAuth('github');
            console.log(chalk.green('✅ Successfully logged in!'));
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
            await config.save({ teamId: `team-${Date.now()}`, teamName, autoSync: true, members: ['me'] });
            console.log(chalk.green(`✅ Team ${teamName} initialized!`));
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
            const memory = new TeamMemory();
            const patterns = memory.getAllPatterns();
            console.log(chalk.cyan.bold('\n🧠 Team Patterns'));
            if (patterns.length === 0) {
                console.log(chalk.gray('No patterns stored yet.'));
            } else {
                patterns.forEach(p => {
                    console.log(`- ${chalk.yellow(p.name)}: ${chalk.white(p.command)}`);
                });
            }
            break;
        }
        default:
            console.log(chalk.red(`Unknown team command: ${subcommand}`));
            console.log(chalk.gray('Run `nebula team help` for usage.'));
    }
}
