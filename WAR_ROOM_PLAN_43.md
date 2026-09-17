# Issue 43: Create Plugin System: Community-Contributed Healing Patterns

- [x] 1. Create plugin sandbox (`src/plugins/sandbox.js`) to prevent malicious code execution.
- [x] 2. Create plugin API (`src/plugins/api.js`) to expose necessary functions to plugins.
- [x] 3. Create plugin registry (`src/plugins/registry.js`) for managing (loading, resolving, registering) plugins.
- [x] 4. Create testing framework (`src/plugins/testing.js`) for testing plugins.
- [x] 5. Implement built-in `docker` plugin (`src/plugins/builtin/docker.js`).
- [x] 6. Implement built-in `git` plugin (`src/plugins/builtin/git.js`).
- [x] 7. Implement built-in `npm` plugin (`src/plugins/builtin/npm.js`).
- [x] 7a. Convert plugin module files (api/sandbox/registry/testing) to ESM so they are importable in the `"type": "module"` package. Builtin plugins stay CommonJS since they run inside the vm sandbox.
- [x] 8. Implement plugin management commands (`src/commands/plugin.js`) for CLI: `list`, `scaffold`, `install`, `test`, `docs`.
- [x] 8a. Add `loadAll()` convenience to registry that loads builtins + user/project plugins.
- [x] 9. Export main plugin modules (`src/plugins/index.js`).
- [x] 10. Integrate plugin commands into CLI entry point (`src/index.js` or equivalent) and wire plugin healing patterns into the one-shot failure handler.
- [x] 11. Write a test file for the plugin system to ensure it meets acceptance criteria (`test/unit/plugin.test.js` or similar).
- [x] 12. Add `docs/PLUGINS.md` documenting the plugin API, manifest format, and sandbox guarantees.
- [ ] 13. Run lint + full test suite and fix failures (incl. pre-existing path-with-spaces bug in `test/integration/functional.test.js`).