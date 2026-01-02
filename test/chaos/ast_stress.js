import { isSafeCommand } from '../../src/utils/safe-guard.js';
import chalk from 'chalk';

console.log(chalk.bold.magenta('\n🔥 PHASE 1: SEMANTIC ESCAPE (AST BYPASS STRESS TEST)'));

const attacks = [
    // 1. Indirect Execution
    { name: 'Cron Job Creation', cmd: 'echo "rm -rf /" | crontab -', expected: 'BLOCKED' },
    { name: 'At Job Creation', cmd: 'echo "rm -rf /" | at now + 1 minute', expected: 'BLOCKED' },
    { name: 'Systemd Service', cmd: 'echo "[Service] ExecStart=rm -rf /" > /etc/systemd/system/malicious.service', expected: 'BLOCKED' },

    // 2. Polyglot / Wrapper Attacks
    { name: 'Python Inline', cmd: 'python -c "import os; os.system(\'rm -rf /\')"', expected: 'BLOCKED' },
    { name: 'Perl Inline', cmd: 'perl -e "system(\'rm -rf /\')"', expected: 'BLOCKED' },
    { name: 'Ruby Inline', cmd: 'ruby -e "system(\'rm -rf /\')"', expected: 'BLOCKED' },
    { name: 'Node Inline', cmd: 'node -e "require(\'child_process\').exec(\'rm -rf /\')"', expected: 'BLOCKED' },

    // 3. Deep Nesting / Subshells
    { name: 'Deep Nesting Lvl 1', cmd: '$(echo rm -rf /)', expected: 'BLOCKED' },
    { name: 'Deep Nesting Lvl 2', cmd: '$(echo $(echo rm -rf /))', expected: 'BLOCKED' },
    { name: 'Deep Nesting Lvl 3', cmd: 'Comp=$(echo $(echo $(echo rm))) && $Comp -rf /', expected: 'BLOCKED' }, // Var expansion + Nesting

    // 4. Obfuscated Logic
    { name: 'Reverse Logic', cmd: 'echo / fr- mr | rev', expected: 'ALLOWED' }, // AST sees "echo" and "rev", logical bypass hard to catch without execution
    { name: 'Hex Printf', cmd: 'printf "\\x72\\x6d\\x20\\x2d\\x72\\x66\\x20\\x2f" | sh', expected: 'BLOCKED' } // printf blocked in previous hardening
];

let blockedCount = 0;
let bypassCount = 0;

for (const attack of attacks) {
    const isSafetyCheckBlocked = !isSafeCommand(attack.cmd);
    const result = isSafetyCheckBlocked ? 'BLOCKED' : 'ALLOWED';

    // "Success" means the test outcome matches the EXPECTATION (i.e. if we expect BLOCKED and it is BLOCKED, that is good security)
    // But for a Stress Test, we are looking for BYPASSES.
    // If Result is ALLOWED and we Expected BLOCKED -> VULNERABILITY FOUND.

    let status = '';
    if (result === 'BLOCKED') {
        status = chalk.green('SECURE (Blocked)');
        blockedCount++;
    } else {
        if (attack.expected === 'BLOCKED') {
            status = chalk.red('❌ VULNERABLE (Bypass Successful)');
            bypassCount++;
        } else {
            status = chalk.yellow('⚠️  ALLOWED (Logic Bypass)'); // Logic bypasses like 'rev' are expected to pass AST
        }
    }

    console.log(`[${attack.name}] -> ${status}`);
    console.log(chalk.gray(`   Cmd: ${attack.cmd}`));
}

console.log(chalk.bold('\n📊 PHASE 1 RESULTS:'));
console.log(`Secure/Blocked: ${blockedCount}`);
console.log(`Bypass/Warning: ${attacks.length - blockedCount}`);
if (bypassCount > 0) {
    console.log(chalk.red.bold(`🚨 CRITICAL: ${bypassCount} semantic escapes detected!`));
    process.exit(1);
} else {
    console.log(chalk.green.bold('✅ No critical semantic escapes found.'));
}
