import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runInSandbox } from '../../src/plugins/sandbox.js';
import { createAPI } from '../../src/plugins/api.js';
import { PluginTester } from '../../src/plugins/testing.js';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { scaffoldPlugin, runPluginTest, installPlugin, userPluginDir } from '../../src/commands/plugin.js';

const SAMPLE_PLUGIN = `
module.exports = {
    init: function(api) {
        api.registerInfo({
            name: 'sample',
            version: '1.0.0',
            description: 'heals sample errors',
            author: 'tester',
            dependencies: []
        });
        api.registerPattern({
            name: 'sample-enoent',
            match: /ENOENT: no such file/i,
            heal: function(errorMessage) {
                return {
                    action: 'run_command',
                    command: 'mkdir -p ./node_modules',
                    explanation: 'The node_modules directory is missing. Creating it.'
                };
            }
        });
        api.registerPattern({
            name: 'sample-permission',
            match: function(errorMessage) { return /EACCES/.test(errorMessage); },
            heal: function(errorMessage) {
                return { action: 'inform', explanation: 'Chmod the target file.' };
            }
        });
    }
};
`;

const tmpDirs = [];

function makeTmpDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-plugin-test-'));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('plugin sandbox', () => {
    it('executes a valid plugin and returns its exports', () => {
        const moduleExports = runInSandbox(SAMPLE_PLUGIN, createAPI('sample'));
        expect(typeof moduleExports.init).toBe('function');
    });

    it('blocks the constructor/eval vm-escape vector', () => {
        const escape = `
            module.exports = { init: function() {} };
            this.constructor.constructor("return process")().exit(1);
        `;
        expect(() => runInSandbox(escape, createAPI('evil'))).toThrow(/Forbidden|constructor/i);
    });

    it('does not expose require() or process', () => {
        const malicious = `
            module.exports = {
                init: function(api) {
                    if (typeof require === 'function') throw new Error('require leaked');
                    if (typeof process !== 'undefined') throw new Error('process leaked');
                }
            };
        `;
        const moduleExports = runInSandbox(malicious, createAPI('probe'));
        const api = createAPI('probe');
        expect(() => moduleExports.init(api)).not.toThrow();
    });

    it('registry refuses plugins that attempt forbidden access', () => {
        const registry = new PluginRegistry();
        const escape = `
            module.exports = { init: function() {} };
            this.constructor.constructor("return process")().exit(1);
        `;
        expect(registry.loadPluginFromSource('evil', escape)).toBe(false);
        expect(registry.errors.get('evil')).toMatch(/Forbidden|constructor/i);
    });

    it('terminates runaway plugins via the sandbox timeout', () => {
        const infiniteLoop = `
            module.exports = {
                init: function(api) {
                    var start = Date.now();
                    while (Date.now() - start < 5000) {}
                }
            };
        `;
        const started = Date.now();
        const registry = new PluginRegistry();
        const ok = registry.loadPluginFromSource('hanger', infiniteLoop);
        expect(ok).toBe(false);
        expect(Date.now() - started).toBeLessThan(3000);
    });
});

describe('plugin api', () => {
    it('registers patterns and metadata', () => {
        const api = createAPI('sample');
        api.registerInfo({ name: 'sample', version: '1.2.3', description: 'desc', dependencies: [] });
        api.registerPattern({ name: 'p', match: /x/, heal: () => ({}) });
        expect(api.patterns).toHaveLength(1);
        expect(api.info.version).toBe('1.2.3');
    });

    it('rejects non-semantic versions', () => {
        const api = createAPI('sample');
        expect(() => api.registerInfo({ version: 'not-semver' })).toThrow(/semantic/i);
        expect(() => api.registerInfo({ version: 'v1.0.0' })).toThrow(/semantic/i);
    });

    it('rejects invalid pattern shapes', () => {
        const api = createAPI('sample');
        expect(() => api.registerPattern({})).toThrow(/Invalid pattern/i);
    });

    it('collects dependencies via dependsOn', () => {
        const api = createAPI('a');
        api.dependsOn('b');
        api.dependsOn('c');
        expect(api.info.dependencies).toEqual(['b', 'c']);
    });
});

describe('plugin tester', () => {
    it('matches, heals and round-trips a sample plugin', () => {
        const tester = new PluginTester(SAMPLE_PLUGIN);

        const regexMatch = tester.match('error: ENOENT: no such file or directory');
        expect(regexMatch.name).toBe('sample-enoent');

        const fnMatch = tester.match('EACCES permission denied');
        expect(fnMatch.name).toBe('sample-permission');

        const diagnosis = tester.diagnose('ENOENT: no such file');
        expect(diagnosis.pattern.name).toBe('sample-enoent');
        expect(diagnosis.action.action).toBe('run_command');

        expect(tester.match('random unrelated output')).toBeNull();
    });
});

describe('plugin registry', () => {
    it('loads plugins from source and exposes patterns', () => {
        const registry = new PluginRegistry();
        expect(registry.loadPluginFromSource('sample', SAMPLE_PLUGIN)).toBe(true);
        const info = registry.getAllPluginInfo();
        expect(info).toHaveLength(1);
        expect(info[0].name).toBe('sample');
        expect(info[0].patterns).toBe(2);
    });

    it('finds a healing pattern for a matching error', () => {
        const registry = new PluginRegistry();
        registry.loadPluginFromSource('sample', SAMPLE_PLUGIN);
        const pattern = registry.findHealingPattern('garbage ENOENT: no such file garbage');
        expect(pattern.name).toBe('sample-enoent');
        const healResult = pattern.heal('ENOENT');
        expect(healResult.action).toBe('run_command');
        expect(healResult.command).toContain('mkdir');
    });

    it('resolves installed dependencies and rejects missing ones', () => {
        const registry = new PluginRegistry();
        const base = `
            module.exports = { init: function(api) {
                api.registerInfo({ name: 'base', version: '1.0.0', dependencies: [] });
            }};
        `;
        const usesBase = `
            module.exports = { init: function(api) {
                api.registerInfo({ name: 'uses-base', version: '1.0.0', dependencies: ['base'] });
            }};
        `;
        const orphan = `
            module.exports = { init: function(api) {
                api.registerInfo({ name: 'orphan', version: '1.0.0', dependencies: ['does-not-exist'] });
            }};
        `;
        expect(registry.loadPluginFromSource('base', base)).toBe(true);
        expect(registry.loadPluginFromSource('uses-base', usesBase)).toBe(true);
        expect(registry.loadPluginFromSource('orphan', orphan)).toBe(false);
        expect(registry.errors.get('orphan')).toContain('does-not-exist');
    });

    it('loads the three built-in plugins (docker, git, npm)', () => {
        const registry = new PluginRegistry();
        registry.loadBuiltins();
        const names = registry.getAllPluginInfo().map((p) => p.name).sort();
        expect(names).toEqual(['docker', 'git', 'npm']);

        const pattern = registry.findHealingPattern('Cannot connect to the Docker daemon');
        expect(pattern.name).toBe('docker-daemon-not-running');

        const gitPattern = registry.findHealingPattern('fatal: not a git repository');
        expect(gitPattern.name).toBe('git-not-a-repository');

        const npmPattern = registry.findHealingPattern("Cannot find module 'lodash'");
        expect(npmPattern.name).toBe('npm-missing-module');
        expect(npmPattern.heal("Cannot find module 'lodash'").command).toBe('npm install lodash');
    });
});

describe('plugin scaffold + test command helpers', () => {
    it('scaffolds a valid, testable plugin', () => {
        const dir = makeTmpDir();
        const filePath = scaffoldPlugin('my-cool-plugin', dir);
        expect(fs.existsSync(filePath)).toBe(true);

        const result = runPluginTest(filePath, 'example error message happened');
        expect(result.matched).toBe('my-cool-plugin-example-error');
        expect(result.action.action).toBe('inform');
    });

    it('rejects invalid names and refuses to overwrite', () => {
        const dir = makeTmpDir();
        const filePath = scaffoldPlugin('good-name', dir);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(() => scaffoldPlugin('bad name!', dir)).toThrow(/Invalid plugin name/i);
        expect(() => scaffoldPlugin('good-name', dir)).toThrow(/already exists/i);
    });
});

describe('plugin install helper', () => {
    it('installs a local plugin file into the user plugin directory', async () => {
        const dir = makeTmpDir();
        const sourcePath = path.join(dir, 'installed-me.js');
        fs.writeFileSync(sourcePath, SAMPLE_PLUGIN);

        const homeDir = makeTmpDir();
        const realHomedir = os.homedir;
        os.homedir = () => homeDir;
        try {
            const targetPath = await installPlugin(sourcePath);
            expect(targetPath).toBe(path.join(userPluginDir(), 'installed-me.js'));
            expect(fs.existsSync(targetPath)).toBe(true);
        } finally {
            os.homedir = realHomedir;
        }
    });

    it('rejects a local source that does not exist', async () => {
        await expect(installPlugin('/nonexistent/plugin.js')).rejects.toThrow(/not found/i);
    });

    it('rejects plugin files that fail sandbox validation', async () => {
        const dir = makeTmpDir();
        const evilPath = path.join(dir, 'evil.js');
        fs.writeFileSync(evilPath, 'this.constructor.constructor("return process")()');

        const homeDir = makeTmpDir();
        const realHomedir = os.homedir;
        os.homedir = () => homeDir;
        try {
            await expect(installPlugin(evilPath)).rejects.toThrow(/NOT installed/i);
        } finally {
            os.homedir = realHomedir;
        }
    });
});