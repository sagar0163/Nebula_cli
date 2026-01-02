import { isSafeCommand } from '../../src/utils/safe-guard.js';
import chalk from 'chalk';

console.log(chalk.bold.magenta('\n🔥 PHASE 4: RACE CONDITIONS (TOCTOU CONCURRENCY TEST)'));

const SAFE_CMD = 'echo hello';
const BAD_CMD = 'rm -rf /';

// Helper to sleep random ms
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function storm() {
    console.log(chalk.blue('Flooding safety checks with mixed safe/unsafe commands...'));

    const iterations = 100;
    const promises = [];

    // Mix safe and unsafe commands rapidly
    for (let i = 0; i < iterations; i++) {
        const isBad = i % 3 === 0; // Every 3rd is bad
        const cmd = isBad ? BAD_CMD : SAFE_CMD;

        promises.push((async () => {
            // Simulate minimal async delay before/after if check was async (it's not, but let's wrap it)
            // Testing if any closure scope leaks variables between calls
            await sleep(Math.random() * 5);
            const result = isSafeCommand(cmd);
            await sleep(Math.random() * 5);
            return { cmd, result, expected: !isBad };
        })());
    }

    const results = await Promise.all(promises);

    let failures = 0;
    results.forEach((res, idx) => {
        if (res.result !== res.expected) {
            console.log(chalk.red(`Race Condition Detected at index ${idx}! Cmd: ${res.cmd} | Allowed: ${res.result}`));
            failures++;
        }
    });

    if (failures === 0) {
        console.log(chalk.green(`✅ Processed ${iterations} concurrent checks with 0 failures.`));
        console.log(chalk.green('   Synchronous AST parsing prevents TOCTOU state corruption.'));
    } else {
        console.log(chalk.red.bold(`🚨 CRITICAL: ${failures} Race Conditions detected!`));
        process.exit(1);
    }
}

storm();
