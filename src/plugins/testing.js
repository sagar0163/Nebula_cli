const { createAPI } = require('./api');
const { runInSandbox } = require('./sandbox');

class PluginTester {
    constructor(pluginCode) {
        this.api = createAPI('test-plugin');
        this.plugin = runInSandbox(pluginCode, this.api);
        
        if (typeof this.plugin.init === 'function') {
            this.plugin.init(this.api);
        }
    }

    /**
     * Test if the plugin matches a given error message.
     * @param {string} errorMessage 
     * @returns {object|null} The matched pattern, or null.
     */
    match(errorMessage) {
        for (const pattern of this.api.patterns) {
            if (typeof pattern.match === 'function' && pattern.match(errorMessage)) {
                return pattern;
            } else if (pattern.match instanceof RegExp && pattern.match.test(errorMessage)) {
                return pattern;
            }
        }
        return null;
    }

    /**
     * Execute the healing function of a matched pattern.
     * @param {object} pattern - The pattern matched.
     * @param {string} errorMessage - The error message.
     * @returns {any} The result of the heal function.
     */
    heal(pattern, errorMessage) {
        return pattern.heal(errorMessage, this.api);
    }
}

module.exports = {
    PluginTester
};
