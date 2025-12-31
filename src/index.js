#!/usr/bin/env node

import { executeSystemCommand } from './utils/executioner.js';

console.log('Nebula-CLI: The Self-Healing Terminal Agent');

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: nebula <command>');
    process.exit(1);
}

// Basic command handling for now
const command = args[0];

if (command === 'test') {
    executeSystemCommand('echo "Hello from Nebula Shell!"')
        .then(output => console.log(output))
        .catch(err => console.error('Error:', err.message));
} else {
    console.log(`Command '${command}' not recognized yet.`);
}
