import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { registry } from '../plugins/registry.js';
import { PluginTester } from '../plugins/testing.js';

const VALID_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function userPluginDir() {
    return path.join(os.homedir(), '.nebula', 'plugins');
}

function projectPluginDir(cwd) {
    return path.join(cwd || process.cwd(), '.nebula', 'plugins');
}

/**
 * Render the scaffold template for a new plugin.
 * Templates run inside the sandbox as CommonJS, so they must use
 * `module.exports` and `api.registerPattern(...)`.
 *
 * @param {string} name - Plugin name.
 * @returns {string} Plugin source code.
 */
function scaffoldTemplate(name) {
    return `/**
 * ${name} - Nebula-CLI healing plugin.
 *
 * Plugins run inside a sandbox with no filesystem, network, or process
 * access. They can only:
 *   - call api.registerInfo(...) to declare metadata (semantic version)
 *   - call api.registerPattern(...) to contribute healing patterns
 *   - use api.runSafeCommand(...) and api.dependsOn(...) (see docs/PLUGINS.md)
 *
 * The \`match\` field is a RegExp (or function returning boolean) tested
 * against the error message. When it matches, \`heal\` returns an action:
 *   { action: 'run_command', command: '...', explanation: '...' }
 *   { action: 'inform', explanation: '...' }
 */
module.exports = {
    init: function(api) {
        api.registerInfo({
            name: '${name}',
            version: '1.0.0',
            description: 'Describe which failures this plugin heals.',
            author: '',
            homepage: '',
            dependencies: []
        });

        api.registerPattern({
            name: '${name}-example-error',
            match: /example error message/i,
            heal: function(errorMessage, api) {
                return {
                    action: 'inform',
                    explanation: 'Explain what the user should do when this error occurs.'
                };
            }
        });
    }
};
`;
}

/**
 * Scaffold a starter plugin file. If no directory is given the file is
 * written to the current project's .nebula/plugins/ directory.
 *
 * @param {string} name - Plugin name (used as the file name).
 * @param {string} [dir] - Target directory; defaults to project plugin dir.
 * @returns {string} Absolute path of the created file.
 */
function scaffoldPlugin(name, dir) {
    if (!VALID_NAME_RE.test(name)) {
        throw new Error(`Invalid plugin name '${name}'. Use letters, digits and '.', '_' or '-'.`);
    }

    const targetDir = dir || projectPluginDir();
    fs.mkdirSync(targetDir, { recursive: true });

    const filePath = path.join(targetDir, `${name}.js`);
    if (fs.existsSync(filePath)) {
        throw new Error(`A plugin named '${name}' already exists at ${filePath}.`);
    }

    fs.writeFileSync(filePath, scaffoldTemplate(name), 'utf-8');
    return filePath;
}

/**
 * Install a plugin into the user plugin directory (~/.nebula/plugins).
 * The source may be a local file path, a file:// URL, or an http(s):// URL.
 * The content is validated by loading it in the sandbox before it is saved.
 *
 * @param {string} source - Local path or http(s)/file URL of the plugin.
 * @param {string} [name] - Plugin name; defaults to the source file name.
 * @returns {string} Absolute path where the plugin was installed.
 */
async function installPlugin(source, name) {
    if (!source) throw new Error('Plugin source is required (path, file:// or http(s):// URL).');

    let content;
    let pluginName = name;

    if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source, { redirect: 'follow' });
        if (!response.ok) {
            throw new Error(`Failed to download plugin from ${source}: HTTP ${response.status}.`);
        }
        content = await response.text();
        if (!pluginName) pluginName = path.basename(new URL(source).pathname, '.js');
    } else {
        const sourcePath = source.startsWith('file://') ? fileURLToPath(source) : source;
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Plugin source not found: ${sourcePath}`);
        }
        content = fs.readFileSync(sourcePath, 'utf-8');
        if (!pluginName) pluginName = path.basename(sourcePath, '.js');
    }

    if (!pluginName || !VALID_NAME_RE.test(pluginName)) {
        throw new Error(`Cannot determine a valid plugin name from '${source}'. Pass one explicitly.`);
    }

    // Validate by loading it in the sandbox before persisting.
    if (!registry.loadPluginFromSource(pluginName, content)) {
        throw new Error(
            `Plugin '${pluginName}' failed validation and was NOT installed. ` +
            `Reason: ${registry.errors.get(pluginName) || 'unknown'}`
        );
    }

    const targetDir = userPluginDir();
    fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, `${pluginName}.js`);
    fs.writeFileSync(targetPath, content, 'utf-8');
    return targetPath;
}

/**
 * Test a plugin file with the plugin testing framework.
 * With a sample error message it runs a full match-and-heal round trip;
 * otherwise it lists the patterns the plugin registers.
 *
 * @param {string} filePath - Path to the plugin file.
 * @param {string} [sampleError] - Optional error message to diagnose.
 * @returns {object} Test result summary.
 */
function runPluginTest(filePath, sampleError) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Plugin file not found: ${absolutePath}`);
    }

    const code = fs.readFileSync(absolutePath, 'utf-8');
    const tester = new PluginTester(code);
    const patterns = tester.api.patterns.map((p) => ({
        name: p.name,
        matchType: typeof p.match === 'function' ? 'function' : 'regex'
    }));

    if (!sampleError) {
        return {
            plugin: tester.api.info,
            patterns,
            sandboxed: true,
            note: `Loaded ${patterns.length} pattern(s). Pass an error message to run a heal round trip.`
        };
    }

    const diagnosis = tester.diagnose(sampleError);
    return {
        plugin: tester.api.info,
        patterns,
        sandboxed: true,
        matched: diagnosis ? diagnosis.pattern.name : null,
        action: diagnosis ? diagnosis.action : null
    };
}

/**
 * Print the documented plugin API surface (also available in docs/PLUGINS.md).
 */
function printPluginDocs() {
    console.log(chalk.bold('\n🌌 Nebula-CLI Plugin API\n'));
    console.log(chalk.gray('Plugins run in a vm sandbox: no process, require, fs, network or eval access.\n'));
    console.log(`${chalk.cyan('api.registerPattern(pattern)')}`);
    console.log('  { name, match: RegExp|fn(error)=>bool, heal(error, api)=>Action }');
    console.log('  Action = { action: "run_command", command, explanation }');
    console.log('         | { action: "inform", explanation }\n');
    console.log(`${chalk.cyan('api.registerInfo({ version, description, author, homepage, dependencies })')}`);
    console.log('  Declares metadata. version is required to be semantic (e.g. "1.2.3").\n');
    console.log(`${chalk.cyan('api.runSafeCommand(cmd)')}`);
    console.log('  Runs a command and returns output; never proposes arbitrary code.\n');
    console.log(`${chalk.cyan('api.dependsOn(name) / dependencies: [...]')}`);
    console.log('  Patches in other plugins before this one initializes.\n');
    console.log(`${chalk.cyan('Plugin manifest (scaffolded automatically)')}`);
    console.log('  module.exports = { init: function(api) { ... } }');
    console.log('  A single file placed in .nebula/plugins/ (project) or');
    console.log('  ~/.nebula/plugins/ (global). See docs/PLUGINS.md for details.');
}

/**
 * Print a table of all available plugins.
 */
function printPluginList() {
    const info = registry.getAllPluginInfo();
    if (info.length === 0) {
        console.log(chalk.yellow('No plugins loaded.'));
        return;
    }

    console.log(chalk.bold('\n🌌 Installed Plugins\n'));
    for (const plugin of info) {
        const deps = plugin.dependencies && plugin.dependencies.length
            ? ` depends: ${plugin.dependencies.join(', ')}`
            : '';
        console.log(`${chalk.green('·')} ${plugin.name} ${chalk.gray(`v${plugin.version}`)}`);
        if (plugin.description) console.log(`    ${plugin.description}`);
        console.log(`    ${chalk.cyan(`${plugin.patterns} pattern(s)`)}${chalk.gray(deps)}`);
    }
    console.log('');
}

/**
 * Entry point for `nebula plugin <subcommand>`.
 *
 * @param {string[]} argv - Remaining arguments after `plugin`.
 */
async function runPluginCommand(argv) {
    const command = argv[0];
    const rest = argv.slice(1);

    switch (command) {
        case 'list':
            registry.loadAll();
            printPluginList();
            return;
        case 'scaffold': {
            const name = rest[0];
            if (!name) {
                console.log(chalk.yellow('Usage: nebula plugin scaffold <name>'));
                return;
            }
            try {
                const filePath = scaffoldPlugin(name);
                console.log(chalk.green(`\n✔ Scaffolded plugin '${name}' at ${filePath}`));
                console.log(chalk.gray('Edit the file, then run `nebula plugin test <file>` to try it.\n'));
            } catch (error) {
                console.log(chalk.red(`✖ ${error.message}`));
            }
            return;
        }
        case 'install': {
            const source = rest[0];
            const name = rest[1];
            if (!source) {
                console.log(chalk.yellow('Usage: nebula plugin install <path|url> [name]'));
                return;
            }
            try {
                const targetPath = await installPlugin(source, name);
                console.log(chalk.green(`\n✔ Installed plugin to ${targetPath}`));
                console.log(chalk.gray('It is sandboxed and will load automatically on the next failure.\n'));
            } catch (error) {
                console.log(chalk.red(`✖ ${error.message}`));
            }
            return;
        }
        case 'test': {
            const filePath = rest[0];
            if (!filePath) {
                console.log(chalk.yellow('Usage: nebula plugin test <file> [sample error message]'));
                return;
            }
            const sampleError = rest.slice(1).join(' ').trim() || null;
            try {
                const result = runPluginTest(filePath, sampleError);
                console.log(chalk.bold(`\n🧪 Plugin: ${result.plugin.name} ${chalk.gray(`v${result.plugin.version}`)}`));
                for (const pattern of result.patterns) {
                    console.log(`  ${chalk.cyan('·')} ${pattern.name} ${chalk.gray(`(${pattern.matchType})`)}`);
                }
                if (result.matched) {
                    console.log(`\n${chalk.green('✓')} Matched '${result.matched}' on error: ${chalk.yellow(sampleError)}`);
                    console.log(`${chalk.gray(JSON.stringify(result.action))}`);
                } else if (sampleError) {
                    console.log(`\n${chalk.yellow('✗')} No pattern matched: ${chalk.yellow(sampleError)}`);
                } else {
                    console.log(`\n${chalk.gray(result.note)}`);
                }
                console.log('');
            } catch (error) {
                console.log(chalk.red(`✖ ${error.message}`));
            }
            return;
        }
        case 'docs':
            printPluginDocs();
            return;
        default:
            console.log(chalk.bold('\n🌌 Nebula-CLI Plugin Manager\n'));
            console.log(chalk.cyan('Usage: nebula plugin <command>\n'));
            console.log('  list       List installed plugins and their healing patterns');
            console.log('  scaffold   Create a new plugin from a starter template');
            console.log('  install    Install a plugin from a local path, file:// or https:// URL');
            console.log('  test       Test a plugin file (optionally with a sample error message)');
            console.log('  docs       Show the Plugin API reference\n');
    }
}

export { runPluginCommand, scaffoldPlugin, installPlugin, runPluginTest, printPluginDocs, userPluginDir, projectPluginDir };