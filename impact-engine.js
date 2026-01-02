import { execSync } from 'child_process';

function getGitStats() {
    try {
        // 1. Get Line stats for Impact
        const stats = execSync('git diff HEAD --shortstat', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        const insertions = parseInt(stats.match(/(\d+) insertion/)?.[1] || 0);
        const deletions = parseInt(stats.match(/(\d+) deletion/)?.[1] || 0);
        const totalChanges = insertions + deletions;

        // 2. Get Filenames for Message Intelligence
        const files = execSync('git diff HEAD --name-only', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().split('\n').filter(Boolean);

        return { totalChanges, files };
    } catch (e) {
        return { totalChanges: 0, files: [] };
    }
}

function generateCommitMessage(files) {
    if (files.length === 0) return "chore: minor updates";

    // Logic to determine Conventional Commit Type
    let type = 'feat'; // Default
    if (files.every(f => f.endsWith('.md'))) type = 'docs';
    else if (files.some(f => f.includes('test'))) type = 'test';
    else if (files.some(f => f.includes('package.json') || f.includes('.env'))) type = 'chore';
    else if (files.some(f => f.includes('src/utils'))) type = 'refactor';

    // Logic to build a clean, lowercase subject (Lint-Safe)
    const mainFile = files[0].split('/').pop().replace(/\.[^/.]+$/, "");
    const subject = `update ${mainFile} and ${files.length - 1} other files`;

    // Ensure: Lowercase, no period (satisfies commitlint)
    return `${type}: ${subject.toLowerCase()}`.replace(/\.$/, "");
}

function getVersionBump(changes) {
    if (changes > 500) return 'major';
    if (changes > 100) return 'minor';
    return 'patch';
}

const { totalChanges, files } = getGitStats();

// We output the version bump to stdout so 'release-it' can read it
const bump = getVersionBump(totalChanges);
const message = generateCommitMessage(files);

// Exporting both for Nebula to use
if (process.argv.includes('--message')) {
    console.log(message);
} else {
    console.log(bump);
}
