import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, 'tyk_crash.log');
const LINES = 50000;

// 1. Generate Log File
console.log(chalk.blue(`generating ${LINES} lines of logs...`));
const stream = fs.createWriteStream(LOG_FILE);
for (let i = 0; i < LINES; i++) {
    stream.write(`[${new Date().toISOString()}] [error] [upstream-service] Connection timed out: 10.0.0.${i % 255}\n`);
}
stream.end();

stream.on('finish', async () => {
    console.log(chalk.green('Log file generated.'));

    // 2. Monitor Memory
    const initialMem = process.memoryUsage();
    console.log(chalk.bold('\n📊 Initial Memory Usage:'));
    console.log(`RSS: ${(initialMem.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Used: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    try {
        console.log(chalk.yellow('\nLoading log file into memory...'));
        const content = fs.readFileSync(LOG_FILE, 'utf-8');

        console.log(chalk.yellow('Simulating Context Processing...'));
        // Simulate splitting/processing for AI context window
        // This effectively needlessly duplicates strings, stressing the GC
        const tokens = content.split(' ');
        const vectorish = tokens.map(t => t.length);

        const finalMem = process.memoryUsage();
        console.log(chalk.bold('\n📊 Peak Memory Usage:'));
        console.log(`RSS: ${(finalMem.rss / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Heap Used: ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

        const growth = (finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024;
        console.log(chalk.bold.red(`\n📈 Heap Growth: ${growth.toFixed(2)} MB`));

        if (growth > 500) { // arbitrary threshold for "Crash Risk" in chaos
            console.log(chalk.red('🚨 MEMORY CRITICAL: Potential OOM Risk detected.'));
            process.exit(1);
        } else {
            console.log(chalk.green('✅ Memory Stress Passed (Managed Load).'));
        }

    } catch (e) {
        console.log(chalk.red('❌ CRASHED during processing:'), e.message);
        process.exit(1);
    } finally {
        // Cleanup
        // fs.unlinkSync(LOG_FILE); // Keep for inspection if needed, or delete? chaos... let's keep.
    }
});
