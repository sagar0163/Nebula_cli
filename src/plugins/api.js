const { execSync } = require('child_process');

class PluginAPI {
    constructor(pluginName) {
        this.pluginName = pluginName;
        this.patterns = [];
    }

    /**
     * Register a healing pattern.
     * @param {object} pattern - The healing pattern object.
     * @param {string} pattern.name - Name of the pattern.
     * @param {RegExp|function} pattern.match - RegExp to match error output or function that returns boolean.
     * @param {function} pattern.heal - Function to execute when matched, returns action to take.
     */
    registerPattern(pattern) {
        if (!pattern.name || !pattern.match || !pattern.heal) {
            throw new Error('Invalid pattern structure. Requires name, match, and heal properties.');
        }
        this.patterns.push(pattern);
    }

    /**
     * Safe execution of commands for plugins.
     * In a real implementation, this might use a stricter whitelist or validation.
     * @param {string} command - Command to run
     */
    runSafeCommand(command) {
        try {
            return execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        } catch (error) {
            return error.message;
        }
    }
}

function createAPI(pluginName) {
    return new PluginAPI(pluginName);
}

module.exports = {
    createAPI
};
