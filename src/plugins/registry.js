import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { runInSandbox } from './sandbox.js';
import { createAPI } from './api.js';

function isRegExp(value) {
    return (
        value != null &&
        typeof value.test === 'function' &&
        Object.prototype.toString.call(value) === '[object RegExp]'
    );
}

function userPluginDir() {
    return path.join(os.homedir(), '.nebula', 'plugins');
}

function projectPluginDir(cwd) {
    return path.join(cwd || process.cwd(), '.nebula', 'plugins');
}

class PluginRegistry {
    constructor() {
        this.plugins = new Map();
        this.apis = new Map();
        this.errors = new Map();
    }

    /**
     * Load a plugin from a source string.
     * @param {string} name - Plugin name.
     * @param {string} code - Plugin source code.
     * @returns {boolean} Whether the plugin loaded successfully.
     */
    loadPluginFromSource(name, code) {
        const api = createAPI(name);
        let moduleExports;

        try {
            moduleExports = runInSandbox(code, api);
        } catch (error) {
            this.errors.set(name, error.message);
            console.error(`[Registry] Failed to load plugin '${name}': ${error.message}`);
            return false;
        }

        if (typeof moduleExports.init === 'function') {
            // Dependencies must be resolvable before a plugin can initialize.
            // Note: init() is already invoked inside the sandbox by
            // runInSandbox() with this api, so it must NOT be called again here.
            if (!this.resolveDependencies(name, moduleExports, api)) {
                return false;
            }
        } else {
            console.warn(`[Registry] Plugin '${name}' missing init() function.`);
        }

        this.plugins.set(name, moduleExports);
        this.apis.set(name, api);
        return true;
    }

    /**
     * Verify that all declared dependencies are satisfied, loading them from any
     * known plugin directory when needed.
     * @param {string} name - Plugin being loaded.
     * @param {object} moduleExports - Loaded plugin exports (may carry `dependencies`).
     * @param {object} api - Plugin API for the plugin being loaded.
     * @returns {boolean}
     */
    resolveDependencies(name, moduleExports, api) {
        const deps =
            (moduleExports.dependencies && Array.from(moduleExports.dependencies)) || api.info.dependencies || [];

        for (const dep of deps) {
            if (this.plugins.has(dep) || this.apis.has(dep)) continue;

            const depPath = this.findPluginPath(dep);
            if (depPath) {
                if (!this.loadPluginFromFile(dep, depPath)) {
                    this.errors.set(name, `Missing dependency '${dep}' for plugin '${name}'.`);
                    console.error(`[Registry] Plugin '${name}' requires dependency '${dep}' which failed to load.`);
                    return false;
                }
                continue;
            }

            this.errors.set(name, `Missing dependency '${dep}' for plugin '${name}'.`);
            console.error(`[Registry] Plugin '${name}' requires dependency '${dep}' but it is not installed.`);
            return false;
        }
        return true;
    }

    /**
     * Look for a plugin file across the built-in and user plugin directories.
     * @param {string} name - Plugin name.
     * @returns {string|null} Absolute path if found, otherwise null.
     */
    findPluginPath(name) {
        for (const dir of this.pluginSearchDirs()) {
            const candidate = path.join(dir, `${name}.js`);
            if (fs.existsSync(candidate)) return candidate;
        }
        return null;
    }

    /**
     * Directories searched for installable plugins, in priority order.
     * @returns {string[]}
     */
    pluginSearchDirs() {
        const dirs = [];
        try {
            const here = path.dirname(fileURLToPath(import.meta.url));
            dirs.push(path.join(here, 'builtin'));
        } catch {
            /* ignore */
        }
        dirs.push(userPluginDir(), projectPluginDir());
        return dirs;
    }

    /**
     * Load a plugin from a file path.
     * @param {string} name - Plugin name.
     * @param {string} filePath - Path to plugin file.
     * @returns {boolean} Whether the plugin loaded successfully.
     */
    loadPluginFromFile(name, filePath) {
        try {
            let code;
            if (filePath.startsWith('file://')) {
                code = fs.readFileSync(fileURLToPath(filePath), 'utf-8');
            } else {
                code = fs.readFileSync(filePath, 'utf-8');
            }
            return this.loadPluginFromSource(name, code);
        } catch (error) {
            this.errors.set(name, error.message);
            console.error(`[Registry] Failed to load plugin '${name}' from ${filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Load all built-in plugins.
     */
    loadBuiltins() {
        const builtinDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'builtin');
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
     * Load all plugins from the user and project plugin directories.
     */
    loadUserPlugins() {
        for (const dir of [userPluginDir(), projectPluginDir()]) {
            if (!fs.existsSync(dir)) continue;
            for (const file of fs.readdirSync(dir)) {
                if (file.endsWith('.js')) {
                    const pluginName = file.replace('.js', '');
                    this.loadPluginFromFile(pluginName, path.join(dir, file));
                }
            }
        }
    }

    /**
     * Load every discoverable plugin: built-ins first, then user and project
     * plugin directories. Safe to call multiple times; re-loads replace the
     * existing registration for each plugin.
     */
    loadAll() {
        this.loadBuiltins();
        this.loadUserPlugins();
    }

    /**
     * Get all registered patterns from all plugins.
     * @returns {object[]}
     */
    getAllPatterns() {
        let allPatterns = [];
        for (const api of this.apis.values()) {
            allPatterns = allPatterns.concat(api.patterns);
        }
        return allPatterns;
    }

    /**
     * Get metadata for every loaded plugin.
     * @returns {object[]}
     */
    getAllPluginInfo() {
        const info = [];
        for (const [name, api] of this.apis.entries()) {
            info.push({ name, ...api.info, patterns: api.patterns.length });
        }
        return info;
    }

    /**
     * Find a healing pattern that matches the given error. Regexes created inside
     * the sandbox belong to a different realm, so `instanceof RegExp` is not
     * reliable - use a duck-type check instead.
     * @param {string} errorMessage - The error string.
     * @returns {object|null} The first matching pattern, or null.
     */
    findHealingPattern(errorMessage) {
        for (const api of this.apis.values()) {
            for (const pattern of api.patterns) {
                if (typeof pattern.match === 'function' && pattern.match(errorMessage)) {
                    return pattern;
                } else if (isRegExp(pattern.match) && pattern.match.test(errorMessage)) {
                    return pattern;
                }
            }
        }
        return null;
    }
}

// Singleton instance
const registry = new PluginRegistry();

export { registry, PluginRegistry };