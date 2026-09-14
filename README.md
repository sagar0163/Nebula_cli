# Nebula-CLI

**AI memory layer for developers — remembers your workflows, heals your errors.**

[![CI](https://github.com/sagar0163/Nebula_cli/workflows/CI/badge.svg)](https://github.com/sagar0163/Nebula_cli/actions/workflows/ci.yml)
[![Release](https://github.com/sagar0163/Nebula_cli/workflows/Release/badge.svg)](https://github.com/sagar0163/Nebula_cli/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## What Nebula-CLI Does

Nebula-CLI is a terminal agent that learns from your commands and automatically fixes failures. When a command fails, it analyzes the error, suggests a fix, and lets you apply it with one keystroke.

**Core capabilities:**

- **Self-healing**: Detects command failures, diagnoses the issue, suggests and applies fixes
- **Workflow memory**: Remembers successful command patterns and suggests them proactively
- **Natural language**: Convert descriptions into shell commands
- **Session persistence**: Resume interrupted work with full context

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
| `nebula efficiency`       | Show token usage and cache statistics        |
| `nebula release`          | Interactive semantic version release         |

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
    "retentionDays": 90
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

