// TUI Dashboard for Nebula-CLI
// Rich terminal UI using chalk and ora

import chalk from 'chalk';
import ora from 'ora';
import { EOL } from 'os';

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Create a styled header
 */
export function header(text) {
    const width = process.stdout.columns || 80;
    const padding = Math.max(0, Math.floor((width - text.length - 4) / 2));
    const line = '═'.repeat(Math.max(0, width - 4));
    
    return chalk.cyan(`${line}${EOL}║${' '.repeat(padding)}${chalk.bold.cyan(text)}${' '.repeat(width - padding - text.length - 4)}║${EOL}${line}`);
}

/**
 * Create a section box
 */
export function section(title, content) {
    const lines = content.split(EOL);
    const maxLen = Math.max(...lines.map(l => chalk.stripColor(l).length), title.length);
    const width = maxLen + 4;
    
    let output = chalk.gray('┌') + '─'.repeat(width) + chalk.gray('┐') + EOL;
    output += chalk.gray('│ ') + chalk.bold.white(title) + ' '.repeat(width - title.length - 2) + chalk.gray('│') + EOL;
    output += chalk.gray('├') + '─'.repeat(width) + chalk.gray('┤') + EOL;
    
    for (const line of lines) {
        const padded = line + ' '.repeat(width - chalk.stripColor(line).length - 2);
        output += chalk.gray('│ ') + line + chalk.gray(' │') + EOL;
    }
    
    output += chalk.gray('└') + '─'.repeat(width) + chalk.gray('┘');
    
    return output;
}

/**
 * Create a spinner with text
 */
export function spinner(text) {
    return ora({
        text: chalk.cyan(text),
        spinner: {
            interval: 80,
            frames: SPINNER
        },
        color: 'cyan'
    });
}

/**
 * Progress bar for terminal
 */
export class ProgressBar {
    constructor(total, label = '') {
        this.total = total;
        this.current = 0;
        this.label = label;
        this.width = process.stdout.columns ? process.stdout.columns - 30 : 50;
    }
    
    update(current, label = '') {
        this.current = current;
        if (label) this.label = label;
        
        const percent = Math.min(100, Math.round((this.current / this.total) * 100));
        const filled = Math.round(this.width * (this.current / this.total));
        const empty = this.width - filled;
        
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const percentStr = percent.toString().padStart(3, ' ');
        
        process.stdout.write(`\r${chalk.cyan(bar)} ${percentStr}% ${this.label}`);
        
        if (this.current >= this.total) {
            process.stdout.write(EOL);
        }
    }
    
    succeed(message) {
        this.update(this.total, chalk.green('✓ ') + message);
    }
    
    fail(message) {
        this.update(this.current, chalk.red('✗ ') + message);
    }
}

/**
 * Table renderer
 */
export function table(headers, rows) {
    const colWidths = headers.map((h, i) => 
        Math.max(h.length, ...rows.map(r => (r[i] || '').toString().length))
    );
    
    const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join(chalk.gray(' │ '));
    const separator = colWidths.map(w => '─'.repeat(w)).join(chalk.gray('─┼─'));
    
    let output = chalk.bold(headerLine) + EOL + chalk.gray(separator) + EOL;
    
    for (const row of rows) {
        const rowLine = row.map((cell, i) => 
            (cell || '').toString().padEnd(colWidths[i])
        ).join(chalk.gray(' │ '));
        output += rowLine + EOL;
    }
    
    return output;
}

/**
 * Status indicator
 */
export function status(ok, text) {
    return ok 
        ? chalk.green('✓ ') + text 
        : chalk.red('✗ ') + text;
}

/**
 * Key-value list
 */
export function kvList(data) {
    const maxKeyLen = Math.max(...Object.keys(data).map(k => k.length));
    
    return Object.entries(data)
        .map(([key, value]) => {
            const paddedKey = key.padEnd(maxKeyLen);
            return `  ${chalk.gray(paddedKey)} : ${value}`;
        })
        .join(EOL);
}

export default {
    header,
    section,
    spinner,
    ProgressBar,
    table,
    status,
    kvList
};
