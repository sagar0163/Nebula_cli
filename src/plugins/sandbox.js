const vm = require('vm');

/**
 * Executes plugin code in a sandboxed environment to prevent malicious actions.
 * @param {string} code - The plugin source code.
 * @param {object} api - The Nebula-CLI Plugin API exposed to the sandbox.
 * @returns {object} The exported plugin module.
 */
function runInSandbox(code, api) {
    const sandboxEnv = {
        console: {
            log: (...args) => console.log('[Plugin]', ...args),
            error: (...args) => console.error('[Plugin Error]', ...args),
            warn: (...args) => console.warn('[Plugin Warn]', ...args)
        },
        module: { exports: {} },
        exports: {},
        nebulaAPI: api,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
    };

    sandboxEnv.exports = sandboxEnv.module.exports;

    const context = vm.createContext(sandboxEnv);

    try {
        // Wrap the code so it executes in a closure, providing module and exports
        const script = new vm.Script(`
            (function(module, exports, api) {
                ${code}
            })(module, exports, nebulaAPI);
        `);
        script.runInContext(context, { timeout: 1000 }); // Prevent infinite loops
        return sandboxEnv.module.exports;
    } catch (error) {
        throw new Error(`Plugin execution failed in sandbox: ${error.message}`);
    }
}

module.exports = {
    runInSandbox
};
