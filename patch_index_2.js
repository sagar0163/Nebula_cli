import fs from 'fs';

let content = fs.readFileSync('src/index.js', 'utf8');

// Ensure TaxonomySystem is imported at the top if not already (it's in the same file so might be hard to patch at top, let's just inline import)
const searchStr = "console.log(chalk.yellow('\\n🤖 Nebula is analyzing the failure...'));\\n\\n        try {";
const replacement = `console.log(chalk.yellow('\\n🤖 Nebula is analyzing the failure...'));

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
                console.log(chalk.green(\`\\n🛡️ Taxonomy Fix (Confidence \${Math.round(patternMatch.effectiveConfidence * 100)}%):\`));
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
                        console.log(chalk.red(\`Fix failed: \${e.message}\`));
                        taxonomy.updateConfidence(patternMatch.id, false);
                    }
                }
                return;
            }`;

if (content.match(/console\.log\(chalk\.yellow\('\\n🤖 Nebula is analyzing the failure\.\.\.'\)\);\s*try \{/)) {
    content = content.replace(/console\.log\(chalk\.yellow\('\\n🤖 Nebula is analyzing the failure\.\.\.'\)\);\s*try \{/, replacement);
    fs.writeFileSync('src/index.js', content);
} else {
    console.log("Could not find the target string in index.js");
}
