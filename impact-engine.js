import { execSync } from 'child_process';

function getImpact() {
    try {
        // Check if there are any commits since the last tag
        // If no tags, we default to patch or minor.
        // git describe --tags --abbrev=0 might fail if no tags exist.
        let lastTag = '';
        try {
            lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null').toString().trim();
        } catch {
            // No tags found, assume initial release or simple history
            // If git log exists, we can compare to first commit or just defaults
            return 'patch';
        }

        if (!lastTag) return 'patch';

        // Compare current state (HEAD) to the last Git tag
        const stats = execSync(`git diff ${lastTag} HEAD --shortstat`).toString();

        // Extract numbers of lines changed (insertions + deletions)
        const matches = stats.match(/(\d+) insertion.*(\d+) deletion/) ||
            stats.match(/(\d+) insertion/) ||
            stats.match(/(\d+) deletion/);

        const insertions = matches?.[1] ? parseInt(matches[1]) : 0;
        const deletions = matches?.[2] ? parseInt(matches[2]) : 0;
        const totalChanges = insertions + deletions;

        // Check file count as well for broad refactors
        const fileStats = execSync(`git diff ${lastTag} HEAD --name-only`).toString().trim();
        const fileCount = fileStats.split('\n').filter(Boolean).length;

        // Define Impact logic
        if (totalChanges > 500) return 'major';           // Massive rework
        if (totalChanges > 100 || fileCount > 5) return 'minor'; // Feature/Large fix
        return 'patch';                                   // Small tweaks
    } catch (e) {
        return 'patch'; // Default for errors
    }
}

console.log(getImpact());
