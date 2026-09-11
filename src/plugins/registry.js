const fs = require('fs');
const path = require('path');
const { runInSandbox } = require('./sandbox');
const { createAPI } = require('./api');

class PluginRegistry {
    constructor() {
        this.plugins = new Map();
        this.apis = new Map();
    }

    /**
     * Load a plugin from a source string.
     * @param {string} name - Plugin name.
     * @param {string} code - Plugin source code.
     */
    loadPluginFromSource(name, code) {
        const api = createAPI(name);
        const moduleExports = runInSandbox(code, api);
        
        if (typeof moduleExports.init === 'function') {
            moduleExports.init(api);
        } else {
            console.warn(`[Registry] Plugin '${name}' missing init() function.`);
        }

        this.plugins.set(name, moduleExports);
        this.apis.set(name, api);
        return true;
    }

    /**
     * Load a plugin from a file path.
     * @param {string} name - Plugin name.
     * @param {string} filePath - Path to plugin file.
     */
    loadPluginFromFile(name, filePath) {
        try {
            const code = fs.readFileSync(filePath, 'utf-8');
            return this.loadPluginFromSource(name, code);
        } catch (error) {
            console.error(`[Registry] Failed to load plugin '${name}' from ${filePath}:`, error.message);
            return false;
        }
    }

    /**
     * Load all built-in plugins.
     */
    loadBuiltins() {
        const builtinDir = path.join(__dirname, 'builtin');
        if (!fs.existsSync(builtinDir)) return;

        const files = fs.readdirSync(builtinDir);
        for (const file of files) {
            if (file.endsWith('.js')) {
                const pluginName = file.replace('.js', '');
                this.loadPluginFromFile(pluginName, path.join(builtinDir, file));
            }
        }
    }

    /**
     * Get all registered patterns from all plugins.
     */
    getAllPatterns() {
        let allPatterns = [];
        for (const api of this.apis.values()) {
            allPatterns = allPatterns.concat(api.patterns);
        }
        return allPatterns;
    }

    /**
     * Find a healing pattern that matches the given error.
     * @param {string} errorMessage - The error string.
     */
    findHealingPattern(errorMessage) {
        for (const api of this.apis.values()) {
            for (const pattern of api.patterns) {
                if (typeof pattern.match === 'function' && pattern.match(errorMessage)) {
                    return pattern;
                } else if (pattern.match instanceof RegExp && pattern.match.test(errorMessage)) {
                    return pattern;
                }
            }
        }
        return null;
    }
}

// Singleton instance
const registry = new PluginRegistry();

module.exports = {
    registry,
    PluginRegistry
};
