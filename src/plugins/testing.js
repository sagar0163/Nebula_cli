import { createAPI } from './api.js';
import { runInSandbox } from './sandbox.js';

function isRegExp(value) {
    return (
        value != null &&
        typeof value.test === 'function' &&
        Object.prototype.toString.call(value) === '[object RegExp]'
    );
}

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
            } else if (isRegExp(pattern.match) && pattern.match.test(errorMessage)) {
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

    /**
     * Run a full match-and-heal round trip for an error message.
     * @param {string} errorMessage
     * @returns {object|null} `{ pattern, action }` or null if nothing matched.
     */
    diagnose(errorMessage) {
        const pattern = this.match(errorMessage);
        if (!pattern) return null;
        return { pattern, action: this.heal(pattern, errorMessage) };
    }
}

export { PluginTester };