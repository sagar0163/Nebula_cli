# Nebula-CLI Plugin System

Nebula-CLI's error-healing knowledge is extensible via **plugins**. A plugin is a
single JavaScript file containing one or more *healing patterns*. When a command
fails, Nebula consults every installed plugin (in order) and applies the first
pattern that matches the error output.

Plugins are **sandboxed**: they cannot read your filesystem, open sockets, spawn
processes, or access `process`/`require`. `nebula plugin install` refuses to
persist any plugin that does not load cleanly in the sandbox.

---

## Quick Start

```bash
# 1. Scaffold a plugin in the current project
nebula plugin scaffold my-healer

# 2. Edit .nebula/plugins/my-healer.js and add your patterns

# 3. Test it against a real error message
nebula plugin test .nebula/plugins/my-healer.js EGAD: florp exploded

# 4. Share it: install from a local file or any https:// URL
nebula plugin install https://example.com/plugins/my-healer.js
```

## Plugin Manager Commands

| Command | Description |
| --- | --- |
| `nebula plugin list` | List built-in, user, and project plugins with versions and pattern counts |
| `nebula plugin scaffold <name>` | Create a starter plugin in `.nebula/plugins/` |
| `nebula plugin install <path\|url>` | Install a plugin from a local path, `file://` URL, or `https://` URL |
| `nebula plugin test <file> [error]` | Load a plugin and either list its patterns or run a match-and-heal round trip against a sample error |
| `nebula plugin docs` | Print the in-terminal Plugin API reference |

## Where Plugins Live

| Location | Scope | Path |
| --- | --- | --- |
| Built-ins | Always loaded | `src/plugins/builtin/` (docker, git, npm) |
| User | `~` | `~/.nebula/plugins/` |
| Project | repository | `.nebula/plugins/` |

The project directory wins over the user directory; both win over built-ins for
the same plugin name.

## Plugin File Format

A plugin is a CommonJS module that exports an `init(api)` function. It runs
inside the sandbox, so it must use `module.exports` (no ESM syntax):

```js
module.exports = {
    init: function(api) {
        api.registerInfo({
            name: 'my-healer',
            version: '1.0.0',            // semantic versioning (required)
            description: 'What this plugin heals',
            author: 'you@example.com',
            homepage: 'https://github.com/you/my-healer',
            dependencies: []             // other plugin names to load first
        });

        api.registerPattern({
            name: 'my-healer-florp',
            match: /florp exploded/i,     // RegExp (or function => boolean)
            heal: function(errorMessage, api) {
                return {
                    action: 'run_command', // or 'inform'
                    command: 'fix-the-florp',   // run_command only
                    explanation: 'Explain what is happening and why'
                };
            }
        });
    }
};
```

### Healing Pattern Actions

The `heal()` function must return an action object:

- `{ action: 'run_command', command: '...', explanation: '...' }`
  Nebula will propose `command` to the user (subject to the normal safety check
  and confirmation).
- `{ action: 'inform', explanation: '...' }`
  Nebula prints the explanation; no command is executed.

### `match` field

Either a `RegExp` tested against the error message, or a function
`(errorMessage) => boolean`.

## Plugin API Reference

| Member | Description |
| --- | --- |
| `api.registerPattern({ name, match, heal })` | Register a healing pattern |
| `api.registerInfo({ version, description, author, homepage, dependencies })` | Declare plugin metadata. `version` must adhere to semantic versioning (`MAJOR.MINOR.PATCH`) |
| `api.runSafeCommand(command)` | Run a command safely and return its output. Never run untrusted strings |
| `api.dependsOn(pluginName)` | Declare a runtime dependency on another plugin |

### Dependencies

A plugin can depend on other plugins. Nebula resolves dependencies from the
project/user/built-in plugin directories before the dependent plugin
initializes. If a dependency is missing, the dependent plugin fails to load.

## Sandbox Guarantees

Plugins execute in a `node:vm` context with:

- 1-second execution timeout (prevents infinite loops)
- No `process`, `require`, `fs`, `child_process`, `net`, `Buffer`
- No `eval` / `Function` constructor access
- `constructor` / `__proto__` prototype-pollution vectors blocked via a Proxy guard
- Only a namespaced `console` and `setTimeout`/`clearTimeout`/`setInterval`/`clearInterval`
  are exposed, plus the `nebulaAPI` object
- `nebula plugin install` validates each plugin in the sandbox **before** saving
  it to disk

## Plugin Testing Framework

`src/plugins/testing.js` exports `PluginTester` for writing unit tests and
for the `nebula plugin test` command. Use it in your own test suite:

```js
import { PluginTester } from './src/plugins/testing.js';

const pluginCode = fs.readFileSync('my-healer.js', 'utf-8');
const tester = new PluginTester(pluginCode);

expect(tester.match('florp exploded!').name).toBe('my-healer-florp');
expect(tester.diagnose('florp exploded!').action.action).toBe('run_command');
```

## Community Registry

The community plugin registry is a web service that mirrors the same single-file
plugin format. Point any registry entry URL (returning `text/javascript`) at
`nebula plugin install` to fetch, sandbox-validate, and install it. A future
`nebula plugin search` will query the registry index directly.

## Development Kit Checklist

1. Scaffold: `nebula plugin scaffold <name>`
2. Register metadata (semver `version`) and patterns via `api`
3. Add fixtures + unit tests using `PluginTester`
4. Test locally: `nebula plugin test <file> <sample error>`
5. Lint: `npm run lint`
6. Publish the single `.js` file and link it from the registry