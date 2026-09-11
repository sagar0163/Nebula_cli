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

- [x] **3. Add audit logging**
  - Create `src/utils/audit-logger.js`
  - Log all commands with timestamp, user, command, risk level, outcome
  - Support queryable storage (JSON file)
  - Add enterprise export feature (JSON/CSV)

- [x] **4. Implement safety rules engine**
  - Configurable rules via config file (`nebula-safety.json`)
  - Different rules for different environments (development, staging, production)
  - Rule-based validation beyond regex patterns

- [x] **5. Add Docker sandbox execution**
  - Enhance `src/services/code-sandbox.js` for Docker execution
  - Run commands in Docker container with isolation
  - Network blocking capabilities (`--network none`)
  - Resource limits (`--cpus`, `--memory`)

- [x] **6. Implement rollback capability**
  - Snapshot filesystem before dangerous operations
  - Track changes made (manifest)
  - Provide rollback command/restore API

- [x] **7. Update `isSafeCommand` and related functions**
  - Added `rm -rf` to critical patterns
  - Safety scoring integrated into executioner/CLI

- [x] **8. Update CLI to display safety info**
  - Show safety score for suggestions (analyze + fix flow)
  - Display audit log status, snapshots, env in `status`
  - Show dry-run mode indicator

- [x] **9. Write tests**
  - Unit tests: audit-logger, safety-rules, rollback, code-sandbox, safe-guard scoring

- [x] **10. Update documentation**
  - README safety mechanisms section
  - Config options documentation

## Sub-tasks (ordered by dependency)

1. [x] Add `--dry-run` / `-d` flag parsing in `src/index.js`
2. [x] Create `getSafetyScore(command)` in `src/utils/safe-guard.js`
3. [x] Create `src/utils/audit-logger.js` with logging and query capabilities
4. [x] Implement safety rules engine with config support
5. [x] Enhance `src/services/code-sandbox.js` for Docker execution
6. [x] Implement rollback capability (filesystem snapshot tracking)
7. [x] Update `requireApproval` to support dry-run mode
8. [x] Update CLI output to display safety score and audit info
9. [x] Add/Update tests in `test/unit/`
10. [ ] Final verification and bug fixes