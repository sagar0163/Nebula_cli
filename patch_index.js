import fs from 'fs';

let content = fs.readFileSync('src/index.js', 'utf8');

const setupCommand = "if (cleanedArgs[0] === 'setup') {";
const newCommand = `if (cleanedArgs[0] === 'taxonomy') {
        const { handleTaxonomyCommand } = await import('./commands/taxonomy.js');
        await handleTaxonomyCommand(cleanedArgs.slice(1));
        return;
    }

    if (cleanedArgs[0] === 'setup') {`;

if (content.includes(setupCommand) && !content.includes("cleanedArgs[0] === 'taxonomy'")) {
    content = content.replace(setupCommand, newCommand);
    fs.writeFileSync('src/index.js', content);
} else {
    console.log("Could not find setup command block or already patched.");
}
