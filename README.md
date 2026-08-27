# Nebula-CLI

> **Self-healing terminal agent with AI-powered command recovery and workflow automation**

[![CI](https://github.com/sagar0163/Nebula_cli/workflows/CI/badge.svg)](https://github.com/sagar0163/Nebula_cli/actions/workflows/ci.yml)
[![Release](https://github.com/sagar0163/Nebula_cli/workflows/Release/badge.svg)](https://github.com/sagar0163/Nebula_cli/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## 🎯 Problem

Developers waste hours debugging failed commands, remembering complex CLI flags, and recovering from broken workflows. Traditional terminals offer no intelligence — they just execute and fail.

## 💡 Solution

Nebula-CLI is an **AI-enhanced terminal agent** that:
- **Self-heals failed commands** — analyzes errors, suggests fixes, auto-retries
- **Learns your workflows** — builds personal command memory, suggests aliases/scripts
- **Natural language → CLI** — describe what you want, get the exact command
- **Session persistence** — resume interrupted work, share reproducible sessions

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Nebula-CLI Core                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Command     │  AI Engine   │  Memory      │  Execution     │
│  Parser      │  (LLM/RAG)   │  Store       │  Sandbox       │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

- **Language**: TypeScript (Node.js 20+)
- **AI Providers**: OpenAI, Anthropic, local (Ollama), NVIDIA NIM
- **Storage**: SQLite (local), encrypted sync (optional)
- **Shell Support**: bash, zsh, fish, PowerShell

## 🚀 Quick Start

```bash
# Install globally
npm install -g @nebula/cli

# Or run with npx (no install)
npx @nebula/cli

# Initialize in your project
nebula init

# Start the agent
nebula start
```

## 🔧 Configuration

Create `.nebula/config.json` in your project root:

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "${OPENAI_API_KEY}"
  },
  "memory": {
    "enabled": true,
    "retentionDays": 90,
    "encrypt": true
  },
  "selfHeal": {
    "maxRetries": 3,
    "autoApply": false
  }
}
```

Environment variables (`.env`):
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NVIDIA_API_KEY=nvapi-...
```

## 📖 Usage Examples

### Self-healing failed command
```bash
$ docker compose up -d
❌ Error: port 8080 already in use

$ nebula heal
💡 Detected port conflict on 8080
   Suggested fix: docker compose up -d --port 8081:8080
   [y] Apply  [n] Skip  [e] Edit
```

### Natural language to command
```bash
$ nebula "find all TypeScript files modified in last week, exclude node_modules"
💡 find . -name "*.ts" -type f -mtime -7 ! -path "*/node_modules/*"
```

### Workflow automation
```bash
$ nebula workflow create deploy
📝 Recording... (Ctrl+C to stop)
$ npm run build
$ docker build -t myapp .
$ kubectl apply -f k8s/
$ nebula workflow save deploy
✅ Workflow 'deploy' saved — run with: nebula workflow run deploy
```

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

## 📦 Release Process

1. Bump version: `npm version patch|minor|major`
2. Push tag: `git push origin v0.1.0`
3. GitHub Actions builds, tests, creates release, publishes to npm

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feat/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push branch: `git push origin feat/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js/)
- AI powered by [NVIDIA NIM](https://www.nvidia.com/en-us/ai-data-science/products/nim/), [OpenAI](https://openai.com/), [Anthropic](https://anthropic.com/)
- Inspired by [GitHub Copilot CLI](https://github.com/github/copilot-cli) and [Warp](https://www.warp.dev/)

---

**Made with ❤️ by [Sagar Jadhav](https://github.com/sagar0163)**