import { execSync } from 'child_process';

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

class PluginAPI {
    constructor(pluginName) {
        this.pluginName = pluginName;
        this.patterns = [];
        this.info = {
            name: pluginName,
            version: '0.0.0',
            description: '',
            author: '',
            homepage: '',
            dependencies: []
        };
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
     * Describe the plugin (semantic versioning, description, dependencies).
     * @param {object} info - Plugin metadata.
     * @param {string} info.version - Semantic version, e.g. "1.2.3".
     * @param {string} [info.description] - Short description of the plugin.
     * @param {string} [info.author] - Plugin author.
     * @param {string} [info.homepage] - Project homepage / registry URL.
     * @param {string[]} [info.dependencies] - Names of plugins this plugin depends on.
     */
    registerInfo(info = {}) {
        if (info.version !== undefined) {
            if (typeof info.version !== 'string' || !SEMVER_RE.test(info.version)) {
                throw new Error(
                    `Plugin '${this.pluginName}' has an invalid version '${info.version}'. ` +
                    'Plugins must use semantic versioning (e.g. "1.2.3").'
                );
            }
            this.info.version = info.version;
        }
        if (info.description !== undefined) this.info.description = String(info.description);
        if (info.author !== undefined) this.info.author = String(info.author);
        if (info.homepage !== undefined) this.info.homepage = String(info.homepage);
        if (info.dependencies !== undefined) {
            if (!Array.isArray(info.dependencies)) {
                throw new Error(`Plugin '${this.pluginName}' dependencies must be an array of plugin names.`);
            }
            this.info.dependencies = info.dependencies.map(String);
        }
    }

    /**
     * Register a dependency on another plugin.
     * @param {string} name - Name of the plugin this plugin depends on.
     */
    dependsOn(name) {
        this.info.dependencies.push(String(name));
    }

    /**
     * Safe execution of commands for plugins.
     * In a real implementation, this might use a stricter whitelist or validation.
     * @param {string} command - Command to run
     * @returns {string} Command output (or error message on failure).
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

export { createAPI, PluginAPI };