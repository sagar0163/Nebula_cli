# Nebula-CLI

> **Nebula — The AI that remembers your workflows**

Nebula is an **AI-enhanced terminal agent with persistent memory** that learns your workflows, suggests aliases, and retains context across sessions. Unlike other terminals, Nebula remembers what you've learned and helps you work faster every day.

## 🤖 What Makes Nebula Different?

- **Persistent Memory**: Nebula learns from your commands, errors, and fixes — building a personal knowledge base that grows with you
- **Pattern Detection**: 'You run 5x per day — want me to alias it?'
- **Context-Aware Suggestions**: 'Last time you ran this, you also needed to restart the server'
- **Workflow Memory**: 'Nebula remembers you prefer pnpm, always use --force, and deploy on Fridays'

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                   Nebula-CLI Core                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Command     │  AI Engine   │  Memory      │  Execution     │
│  Parser      │  (LLM/RAG)   │  Store       │  Sandbox       │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

- **Language**: TypeScript (Node.js 20+)
- **AI Providers**: OpenAI, Anthropic, local (Ollama), NVIDIA NIM
- **Memory Storage**: SQLite (local, encrypted by default), optional sync
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

## 🧠 Memory in Action

### Learning Notifications

When Nebula learns from your interactions, you'll see:

```
📝 Nebula learned: you prefer pnpm over npm
📝 Nebula learned: always use --force with docker compose up
📝 Nebula learned: deploy on Fridays avoids CI queue delays
```

### Context-Aware Suggestions

```
💡 Last time you ran this, you also needed to restart the server
💡 You run this 5x per day — want me to alias it as 'deploy'?
💡 Pattern detected: you run `lint` followed by `test` together
```

### Memory Examples

> **Nebula remembers you prefer pnpm, always use --force, and deploy on Fridays**

> **Nebula learned pattern**: Your `git push` always follows `git add .` — I'll suggest the combo next time

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

### Environment variables (`.env`):

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

### Memory Commands

```bash
# Show what Nebula has learned about your workflows
$ nebula memory show
📝 You prefer pnpm over npm
📝 Always use --force with docker commands
📝 Deploy on Fridays avoids delays

# Export memory to share across machines
$ nebula memory export > nebula-memory-backup.json

# Import memory from another machine
$ nebula memory import nebula-memory-backup.json

# Clear specific learned pattern
$ nebula memory forget "bad-habit"
```

### Pattern Detection

```
$ nebula run "deploy"
💡 Pattern detected: You run deploy 5x per day — I've aliased it as 'd'
💡 Would you like me to create an alias 'd' for 'nebula run deploy'?
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