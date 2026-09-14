# Nebula-CLI

**Nebula — The AI that remembers your workflows**

[![CI](https://github.com/sagar0163/Nebula_cli/workflows/CI/badge.svg)](https://github.com/sagar0163/Nebula_cli/actions/workflows/ci.yml)
[![Release](https://github.com/sagar0163/Nebula_cli/workflows/Release/badge.svg)](https://github.com/sagar0163/Nebula_cli/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## What Nebula-CLI Does

Nebula-CLI is a terminal agent that acts as your persistent memory layer. It learns your preferences, recognizes patterns in your commands, and uses that context to anticipate what you need. For example, Nebula remembers you prefer pnpm, always use --force, and deploy on Fridays.

**Core capabilities:**

- **Workflow memory**: Remembers successful command patterns, tool preferences, and project-specific quirks.
- **Context-aware suggestions**: Automatically tailors commands and fixes based on what it has learned about your workflow.
- **Self-healing**: Detects command failures, diagnoses the issue using historical context, and suggests fixes.
- **Natural language**: Convert descriptions into shell commands accurately by leveraging past learned context.
- **Session persistence**: Resume interrupted work with full context.

## Demo

<div align="center">
  <img src="https://github.com/sagar0163/Nebula_cli/assets/placeholder/demo.gif" alt="Nebula-CLI demo: command failure → error analysis → fix suggestion → successful execution" width="700"/>
</div>

<details open>
  <summary>Demo flow (30 seconds)</summary>

1. **Command failure**: Run `nebula docker compose up -d` when port is occupied
2. **Error analysis**: Nebula captures the exit code and error output
3. **Fix suggestion**: AI diagnoses the issue and suggests a fix command
4. **Apply fix**: User presses `y` to apply the suggested fix
5. **Success**: Command completes successfully with the suggested fix applied
</details>

The GIF above is a placeholder while the recording is produced. Here is what a real session looks like:

```text
$ nebula docker compose up -d
Bind for 0.0.0.0:5432 failed: port is already allocated

Nebula is analyzing the failure...
Suggested fix: docker compose up -d -p 5433:5432
Apply? [y/n]: y

Container started on 0.0.0.0:5433
Fix saved to workflow memory — the same error will be healed instantly next time.
```

## Quick Start

**Prerequisites:** Node.js 20+.

```bash
# Install from source (npm package pending release)
git clone git@github.com:sagar0163/Nebula_cli.git
cd Nebula_cli
npm install
npm link

# Run setup wizard (configures AI provider and API keys)
nebula setup

# Start interactive session
nebula

# Or run a one-shot command with auto-healing
nebula docker compose up -d
```

Once published, the same install works in one line: `npm install -g @sagar/nebula-cli`.
## 🛡️ Safety Mechanisms

Nebula-CLI includes a layered safety system for every command it runs.

### Dry-Run Mode

Preview what a command would do without executing it:

```bash
nebula --dry-run "kubectl delete pod nginx"
nebula -d "rm -rf build/"        # short form
```

In dry-run mode commands are skipped, and each attempt is recorded in the audit log with an `dry-run` outcome.

### Safety Scoring

Every suggestion and executed command is rated **0 (very safe) → 100 (very dangerous)**:

| Score | Meaning |
|-------|---------|
| 0     | Read-only / safe (e.g. `ls`, `kubectl get pods`) |
| 10    | Safe read verbs (`get`, `describe`, `list`, `status`) |
| 50    | Unknown / manual execution required |
| 90    | High danger (`$(command)` injection, unsafe pipes) |
| 100   | Critical (`rm -rf /`, `mkfs`, `kubectl delete`) |

View the score for any command:

```bash
nebula analyze "rm -rf ."
```

### Command Validation

- **Syntax check** — parses every command with `bash-parser`; unparseable commands are blocked (fail-closed).
- **Block list** — destructive patterns (`rm -rf`, `mkfs`, `dd`, DB drops, `kubectl delete`, `git push --force`, secret dumping, fork bombs, path traversal, SQL injection).
- **Pipe/executor guard** — only known-safe filter utilities are allowed as pipe targets; interpreters (`bash`, `python`, `node -e` …) are blocked.

### Audit Logging

Every command execution is recorded to `~/.nebula/audit/audit.jsonl`:

```json
{"id":"…","timestamp":"…","user":"sagar","command":"kubectl get pods","risk":"low","score":0,"outcome":"success","cwd":"/project","message":"exit=0"}
```

Fields: `id`, `timestamp`, `user`, `hostname`, `command`, `risk`, `score`, `outcome`, `cwd`, `message`.

Enterprise export (JSON or CSV):

```bash
NEBULA_AUDIT_DIR=/var/log/nebula nebula status   # see where logs live
node -e "import('./src/utils/audit-logger.js').then(m => console.log(m.exportAudit({format:'csv'})))"
```

### Safety Rules Engine

Configurable per-environment rules via `nebula-safety.json` (or `~/.nebula/safety.json`), selected by `NEBULA_ENV`:

```json
{
  "defaultEnvironment": "development",
  "environments": {
    "development": { "allowDestructive": true,  "maxScore": 90, "blockedPatterns": [] },
    "staging":     { "allowDestructive": false, "maxScore": 50, "blockedPatterns": ["/drop\\s+database/i"] },
    "production":  { "allowDestructive": false, "maxScore": 30, "blockedPatterns": ["/rm\\s+-rf\\s+\\//", "/mkfs/"] }
  },
  "sandbox":  { "enabled": false, "image": "node:20-alpine", "network": "none", "cpus": "0.5", "memory": "256m" },
  "rollback": { "enabled": true,  "snapshotDir": "~/.nebula/snapshots" },
  "audit":    { "enabled": true,  "dir": "~/.nebula/audit" }
}
```

### Sandbox Execution (Docker)

Untrusted code can be executed inside an isolated Docker container with network blocking and resource limits:

- `--network none` — blocks all egress for suspicious code
- `--cpus 0.5` and `--memory 256m` — resource limits prevent fork bombs
- Falls back to local execution when Docker is unavailable

### Rollback

File operations are snapshot-backed. Before a risky mutation Nebula snapshots the affected files to `~/.nebula/snapshots/<id>/` and can restore them:

```js
import { createSnapshot, restoreSnapshot, listSnapshots } from './src/utils/rollback.js';
const id = createSnapshot(['package.json']);
// ... risky change ...
restoreSnapshot(id);           // undo
listSnapshots();               // inspect available snapshots
```

### Status Dashboard

Run `nebula status` to view current safety posture: active environment, Docker sandbox availability, pending snapshots, audit log location, and dry-run mode.

### What `nebula setup` Does

The setup wizard walks you through:

1. Selecting an AI provider (OpenAI, Anthropic, Google Gemini, Groq, or local Ollama)
2. Entering your API key (stored in `.env`, never committed)
3. Choosing a model (defaults to cost-effective options)
4. Enabling optional features (memory encryption, auto-heal)

### What `nebula` (Interactive Session) Does

Starting `nebula` without arguments opens an interactive shell where:

- Every command you run is monitored for failures
- Failed commands trigger automatic error analysis
- Fixes are suggested and can be applied with one keystroke
- Successful patterns are remembered for future suggestions

## Real-World Examples

### Docker Debugging

```bash
$ nebula docker compose up -d
Error: Bind for 0.0.0.0:5432 failed: port is already allocated

# Nebula analyzes the error and suggests:
Suggested: docker compose up -d -p 5433:5432
Apply? [y/n]: y
```

### Git Workflow Automation

```bash
$ nebula git push
error: failed to push some refs to 'origin'
hint: Updates were rejected because the remote contains work you do not have locally.

# Nebula suggests the safe resolution:
Suggested: git pull --rebase origin main && git push
Apply? [y/n]: y
```

### CI/CD Failure Analysis

```bash
$ nebula npm test
FAIL src/api/auth.test.js
  ● Authentication middleware › should reject invalid tokens

# Nebula analyzes test output and explains:
The test expects a 401 status but receives 500.
Check: src/middleware/auth.js line 42 - token validation logic
```

### Natural Language to Command

```bash
$ nebula find all TypeScript files modified in the last week, excluding node_modules
Generated: find . -name "*.ts" -type f -mtime -7 ! -path "*/node_modules/*"
Run? [y/n]: y
```

## Commands

| Command                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| `nebula`                  | Start interactive session (default)          |
| `nebula setup`            | Configuration wizard for API keys and models |
| `nebula <command>`        | Run command with auto-healing on failure     |
| `nebula ask "<question>"` | Get step-by-step plan for a task             |
| `nebula chat "<prompt>"`  | General AI chat (planning/design)            |
| `nebula predict`          | Scan project and predict next command        |
| `nebula analyze "<cmd>"`  | Analyze command for risks                    |
| `nebula pty "<cmd>"`      | Run interactive command (vim, htop, ssh)     |
| `nebula run "<cmd>"`      | Smart run with auto-PTY detection            |
| `nebula status`           | Show project context and configuration       |
| `nebula memory`           | View what Nebula has learned                  |
| `nebula memory export`    | Export memory to a JSON file                  |
| `nebula memory import`    | Import memory from a JSON file                |
| `nebula efficiency`       | Show token usage and cache statistics        |
| `nebula release`          | Interactive semantic version release         |

## Memory

Nebula remembers what it learns so you never fix the same thing twice.

### See What Nebula Has Learned

```bash
nebula memory          # learned patterns + statistics
nebula memory list     # recent memory entries
nebula memory stats    # counts + privacy status
nebula memory patterns # detected repeated commands
```

### Export / Import Across Machines

Take your memory with you — move to a new laptop or share with teammates:

```bash
nebula memory export ~/nebula-memory.json
nebula memory import ~/nebula-memory.json   # merge mode
nebula memory forget "docker compose up -d" # remove an entry
```

### Learning in Real Time

Confidence in code? Actually you are in [Advanced session or self-healing
flows](README.md) — when Nebula fixes an error it records it and shows you:

```text
📝 Nebula learned: fixing "docker compose up -d ..."
💡 Pattern: You've fixed "docker compose up -d..." 5 times — want to alias it?
```

Context-aware suggestions appear when history matches your current command:

```text
💡 Last time you ran this, the fix was: docker compose up -d -p 5433:5432
```

### Privacy by Default

- **Encryption at rest** — memory files are encrypted with AES-256-GCM using a
  machine-local key (`~/.nebula-cli/.memory-key`, mode 0600). On by default.
- **Local-first** — nothing leaves your machine unless you explicitly export.
  Cloud sync is off by default and opt-in.
- **GDPR-friendly** — export your data anytime, or erase a single entry with
  `nebula memory forget`.

Override defaults via env:

```bash
NEBULA_MEMORY_ENCRYPTION=false   # opt out of encryption
NEBULA_MEMORY_SYNC=enabled       # opt in to cloud sync
NEBULA_MEMORY_KEY=<hex-key>      # use an explicit machine key
```

## Configuration

### Environment Variables (`.env`)

```bash
# Required: Your AI provider API key (at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
GROQ_API_KEY=gsk_...

# Optional: Local LLM via Ollama
OLLAMA_BASE_URL=http://localhost:11434
```

### Project Configuration (`.nebula/config.json`)

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "fallback": "groq"
  },
  "memory": {
    "enabled": true,
    "retentionDays": 90,
    "encryption": true,
    "localOnly": true
  },
  "selfHeal": {
    "maxRetries": 3,
    "autoApply": false
  }
}
```

## How Self-Healing Works

1. **Command execution**: You run a command (manually or via Nebula)
2. **Failure detection**: Nebula captures the exit code and error output
3. **Pattern matching**: Checks vector memory for similar past failures
4. **AI diagnosis**: If no cached fix, sends error context to your AI provider
5. **Fix suggestion**: Presents a specific, actionable fix command
6. **Safety check**: Validates the fix isn't destructive before suggesting
7. **Learning**: Stores successful fixes for instant recall next time

## Comparison

| Feature                | Nebula-CLI          | GitHub Copilot CLI | Warp             | ai-shell |
| ---------------------- | ------------------- | ------------------ | ---------------- | -------- |
| Self-healing errors    | Yes                 | No                 | No               | No       |
| Workflow memory        | Yes                 | No                 | Limited          | No       |
| Cross-session memory   | Yes                 | No                 | No               | No       |
| Pattern detection      | Yes                 | No                 | No               | No       |
| Encrypted memory       | Yes (default)       | No                 | No               | No       |
| Memory export/import   | Yes                 | No                 | No               | No       |
| Natural language → cmd | Yes                 | Yes                | Yes              | Yes      |
| Local LLM support      | Yes (Ollama)        | No                 | No               | Yes      |
| Interactive PTY        | Yes                 | No                 | Yes              | No       |
| Open source            | Yes                 | Partial            | No               | Yes      |
| Session persistence    | Yes                 | No                 | Yes              | No       |
| Cost                   | BYOK (your API key) | $10/mo             | Free tier + paid | BYOK     |

**Honest assessment:** Copilot CLI has tighter GitHub integration. Warp has a better terminal UX. Nebula-CLI's advantage is self-healing and workflow memory — it learns from your specific failures and fixes.

## Troubleshooting

### "command not found: nebula"

Ensure `nebula`'s global bin is on your PATH after `npm link`:

```bash
npm config get prefix  # Should show a path in your PATH
export PATH="$(npm config get prefix)/bin:$PATH"
```

### "API key not configured" or "No AI provider available"

Run setup again:

```bash
nebula setup
```

Or manually create `.env` in your project root with your API key.

### "Module not found" or import errors

Reinstall dependencies:

```bash
npm install
# If you installed globally, re-link instead:
npm link
```

### Self-healing not triggering

Self-healing only activates when a command fails (non-zero exit code). If your command succeeds but produces errors in stdout, Nebula won't catch it. Use `nebula analyze "<cmd>"` to pre-check commands.

### Memory not suggesting fixes

Memory builds over time. The first time you encounter an error, Nebula asks the AI. The second time, it uses the cached fix. Run `nebula status` to verify memory is enabled.

## Who Uses This

*(Quotes and case studies coming soon once the project reaches v1.0!)*

## Development

```bash
# Clone and install
git clone git@github.com:sagar0163/Nebula_cli.git
cd Nebula_cli
npm install

# Run tests
npm test

# Run with coverage
npm run coverage

# Lint
npm run lint

# Type check
npm run type-check
```

## License

MIT — see [LICENSE](LICENSE) for details.

## Credits

- Built with [Commander.js](https://github.com/tj/commander.js/)
- AI powered by [Google Gemini](https://ai.google.dev/), [Groq](https://groq.com/), [Ollama](https://ollama.ai/)
- Inspired by [GitHub Copilot CLI](https://github.com/github/copilot-cli) and [Warp](https://www.warp.dev/)

