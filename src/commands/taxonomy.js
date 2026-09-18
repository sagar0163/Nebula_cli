import chalk from 'chalk';
import { TaxonomySystem } from '../services/taxonomy.js';

export async function handleTaxonomyCommand(args) {
    const taxonomy = new TaxonomySystem();
    const query = args.join(' ');
    
    if (!query) {
        console.log(chalk.yellow('Please provide a search query. Usage: nebula taxonomy <query>'));
        return;
    }
    
    const results = taxonomy.searchPatterns(query);
    if (results.length === 0) {
        console.log(chalk.gray(`No patterns found matching '${query}'`));
        return;
    }
    
    console.log(chalk.green(`\n🔍 Found ${results.length} patterns for '${query}':\n`));
    results.forEach(res => {
        console.log(chalk.cyan(`ID: ${res.id}`) + chalk.gray(` (Confidence: ${Math.round(res.confidence * 100)}%)`));
        if (res.commandRegex) console.log(`Command Regex: ${res.commandRegex}`);
        if (res.errorRegex) console.log(`Error Regex: ${res.errorRegex}`);
        console.log(chalk.bold(`Fix: ${res.fix}\n`));
    });
}
