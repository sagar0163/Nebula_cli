module.exports = {
    init: function(api) {
        api.registerPattern({
            name: 'npm-missing-module',
            match: /Cannot find module '(.*)'/i,
            heal: function(_errorMessage, _api) {
                const match = _errorMessage.match(/Cannot find module '(.*)'/i);
                const moduleName = match ? match[1] : '';
                if (moduleName && !moduleName.startsWith('.')) {
                    return {
                        action: 'run_command',
                        command: `npm install ${moduleName}`,
                        explanation: `The module '${moduleName}' is missing. Installing it.`
                    };
                }
                return {
                    action: 'inform',
                    explanation: `A local file module is missing: ${moduleName}`
                };
            }
        });

        api.registerPattern({
            name: 'npm-command-not-found',
            match: /command not found: (.*)/i,
            heal: function(_errorMessage, _api) {
                const match = _errorMessage.match(/command not found: (.*)/i);
                const cmd = match ? match[1] : '';
                return {
                    action: 'inform',
                    explanation: `The command '${cmd}' was not found. If this is an npm package, try running 'npx ${cmd}' or installing it globally with 'npm install -g ${cmd}'.`
                };
            }
        });
    }
};
