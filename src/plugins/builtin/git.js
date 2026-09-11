module.exports = {
    init: function(api) {
        api.registerPattern({
            name: 'git-merge-conflict',
            match: /Merge conflict in/i,
            heal: function(errorMessage, api) {
                return {
                    action: 'inform',
                    explanation: 'You have a merge conflict. Please resolve the conflicting files and then run `git add <file>` followed by `git commit`.'
                };
            }
        });

        api.registerPattern({
            name: 'git-not-a-repository',
            match: /fatal: not a git repository/i,
            heal: function(errorMessage, api) {
                return {
                    action: 'run_command',
                    command: 'git init',
                    explanation: 'This directory is not a Git repository. Initializing a new Git repository.'
                };
            }
        });
    }
};
