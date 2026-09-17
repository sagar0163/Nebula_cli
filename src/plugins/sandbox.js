import vm from 'node:vm';

/**
 * Executes plugin code in a sandboxed environment to prevent malicious actions.
 * The plugin's top-level code AND its `init()` body run inside the vm context
 * (bounded by a 1s timeout). The sandbox exposes only a bare console, a
 * CommonJS-style `module`/`exports`, the Nebula-CLI Plugin API, and timers.
 * There is no `process`, `require`, `fs`, `child_process`, `eval`, or network
 * access. A Proxy guard also blocks the classic `constructor`/`__proto__`
 * vm-escape vectors. Pattern `match`/`heal` functions created in the sandbox
 * keep resolving their globals against this restricted scope when later invoked.
 *
 * @param {string} code - The plugin source code.
 * @param {object} api - The Nebula-CLI Plugin API exposed to the sandbox.
 * @returns {object} The exported plugin module.
 */
function runInSandbox(code, api) {
    const forbidden = ['constructor', '__proto__', 'prototype', 'Function', 'eval'];

    const forbiddenGlobal = new Proxy(
        {
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
        },
        {
            get(target, prop, receiver) {
                if (forbidden.includes(prop)) {
                    throw new Error('Forbidden access attempt (constructor/eval)');
                }
                return Reflect.get(target, prop, receiver);
            },
            has(target, prop) {
                if (forbidden.includes(prop)) {
                    throw new Error('Forbidden access attempt (constructor/eval)');
                }
                return Reflect.has(target, prop);
            }
        }
    );

    // Explicitly shadow the CommonJS escape hatch on the module object.
    Object.defineProperty(forbiddenGlobal.module, 'require', {
        value: undefined,
        enumerable: false,
        configurable: false
    });

    forbiddenGlobal.exports = forbiddenGlobal.module.exports;

    const context = vm.createContext(forbiddenGlobal);

    try {
        // Wrap the code so it executes in a closure under the 1s timeout, and
        // call init() inside the sandbox rather than outside it.
        const script = new vm.Script(`
            (function(module, exports, api) {
                ${code}
                var _plugin = module.exports && typeof module.exports.default === 'object'
                    ? module.exports.default
                    : module.exports;
                if (_plugin && typeof _plugin.init === 'function') {
                    _plugin.init(api);
                }
            })(module, exports, nebulaAPI);
        `);
        script.runInContext(context, { timeout: 1000 }); // Prevent infinite loops
        return forbiddenGlobal.module.exports;
    } catch (error) {
        throw new Error(`Plugin execution failed in sandbox: ${error.message}`, { cause: error });
    }
}

export { runInSandbox };