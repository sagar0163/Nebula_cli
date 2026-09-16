import fs from 'fs';

let content = fs.readFileSync('src/commands/session.js', 'utf8');

// Import TaxonomySystem
if (!content.includes('TaxonomySystem')) {
    content = content.replace(
        "import NamespacedVectorMemory from '../services/namespaced-memory.js';",
        "import NamespacedVectorMemory from '../services/namespaced-memory.js';\nimport { TaxonomySystem } from '../services/taxonomy.js';"
    );
}

// Instantiate
if (!content.includes('const taxonomy = new TaxonomySystem()')) {
    content = content.replace(
        "const memory = new NamespacedVectorMemory();",
        "const memory = new NamespacedVectorMemory();\nconst taxonomy = new TaxonomySystem();\n// Load community patterns on startup if exists\nimport path from 'path';\nimport { fileURLToPath } from 'url';\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\ntaxonomy.loadCommunityPatterns(path.join(__dirname, '../../data/community-patterns.json'));"
    );
}

// Update handleAutoHealingSafe
const healRegex = /async function handleAutoHealingSafe\(command, result, rl\) \{\s*try \{\s*const errorMsg = result\.stderr \|\| 'Unknown error';/m;
if (content.match(healRegex)) {
    const replacement = `async function handleAutoHealingSafe(command, result, rl) {
    try {
        const errorMsg = result.stderr || 'Unknown error';

        // 0. Taxonomy Pattern Check (Instant, Local, Proven)
        const patternMatch = taxonomy.match(command, errorMsg);
        if (patternMatch) {
            console.log((await import('chalk')).default.green(\`\\n🛡️ Taxonomy Fix (Confidence \${Math.round(patternMatch.effectiveConfidence * 100)}%):\`));
            console.log((await import('chalk')).default.bold(patternMatch.fix));

            const inquirer = (await import('inquirer')).default;
            const { confirm } = await inquirer.prompt([{
                type: 'confirm', name: 'confirm', message: 'Execute?', default: true
            }]);

            if (confirm) {
                try {
                    const output = await executeSystemCommand(patternMatch.fix, { cwd: SessionContext.getCwd() });
                    console.log(output);
                    taxonomy.updateConfidence(patternMatch.id, true);
                } catch(e) {
                    console.log((await import('chalk')).default.red(\`Fix failed: \${e.message}\`));
                    taxonomy.updateConfidence(patternMatch.id, false);
                }
            }
            return;
        }
`;
    content = content.replace(healRegex, replacement);
}

fs.writeFileSync('src/commands/session.js', content);
