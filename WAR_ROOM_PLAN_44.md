# Issue #44: Improve Safety Mechanisms

## Plan Checklist

- [x] **1. Add dry-run flag support** (`--dry-run` / `-d`)
  - Parse flag in `src/index.js`
  - Pass through to command execution
  - Skip actual execution in dry-run mode

- [x] **2. Implement safety scoring system**
  - Add `getSafetyScore(command)` function in `src/utils/safe-guard.js`
  - Score from 0-100 (0 = very safe, 100 = very dangerous)
  - Display score with each suggestion

- [ ] **3. Add audit logging**
  - Create `src/utils/audit-logger.js`
  - Log all commands with timestamp, user, command, risk level, outcome
  - Support queryable storage (JSON file or simple DB)
  - Add enterprise export feature

- [ ] **4. Implement safety rules engine**
  - Configurable rules via config file
  - Different rules for different environments (development, staging, production)
  - Rule-based validation beyond regex patterns

- [ ] **5. Add Docker sandbox execution**
  - Create `src/utils/code-sandbox.js` (already exists, enhance it)
  - Run commands in Docker container with isolation
  - Network blocking capabilities
  - Resource limits (CPU/memory)

- [ ] **6. Implement rollback capability**
  - Snapshot filesystem before dangerous operations
  - Track changes made
  - Provide rollback command

- [ ] **7. Update `isSafeCommand` and related functions**
  - Enhance existing safety checks
  - Add safety scoring integration

- [ ] **8. Update CLI to display safety info**
  - Show safety score for suggestions
  - Display audit log status
  - Show dry-run mode indicator

- [ ] **9. Write tests**
  - Add tests for new functionality
  - Ensure existing tests pass

- [ ] **10. Update documentation**
  - Update README with new safety features
  - Add config options documentation

## Sub-tasks (ordered by dependency)

1. [x] Add `--dry-run` / `-d` flag parsing in `src/index.js`
2. [x] Create `getSafetyScore(command)` in `src/utils/safe-guard.js`
3. [ ] Create `src/utils/audit-logger.js` with logging and query capabilities
4. [ ] Implement safety rules engine with config support
5. [ ] Enhance `src/utils/code-sandbox.js` for Docker execution
6. [ ] Implement rollback capability (filesystem snapshot tracking)
7. [ ] Update `requireApproval` to support dry-run mode
8. [ ] Update CLI output to display safety score and audit info
9. [ ] Add/Update tests in `test/unit/` and `test/integration/`
10. [ ] Final verification and bug fixes