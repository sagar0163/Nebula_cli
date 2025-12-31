# Nebula-CLI: The Self-Healing Terminal Agent

![Nebula-CLI](https://via.placeholder.com/800x200?text=Nebula-CLI+The+Self-Healing+Terminal+Agent)

> **"A terminal so smart, it fixes itself before you even notice."**

Nebula-CLI is a next-generation terminal agent powered by LLMs (Gemini/Ollama). It doesn't just run commands; it understands your intent, detects failures, and auto-corrects errors in real-time. Whether you're managing Kubernetes clusters or debugging a local Node.js app, Nebula is your silent partner in engineering.

## 🚀 Architecture

Nebula operates as an intelligent layer between you and the OS kernel.

```mermaid
graph TD
    User[User Input] -->|Command| Shell[Nebula Shell]
    Shell -->|Execute| OS[Operating System]
    OS -->|Output/Error| Monitor[Error Monitor]
    Monitor -->|Failure Detected| AI[AI Engine (Gemini/Ollama)]
    AI -->|Fix Suggestion| Shell
    Shell -->|Auto-Heal| OS
```

## ✨ Key Features

*   **RAG Sync**: Seamlessly retrieves context from your local docs and history.
*   **K8s Pilot**: Intelligent Kubernetes management without the `kubectl` complexity.
*   **Safe-Guard**: Analyzes destructive commands (`rm -rf`, `drop table`) before execution.
*   **Self-Healing**: Automatically suggests and applies fixes for common build/runtime errors.
*   **Audit Log**: Local, encrypted SHA-256 logs of every action for compliance and rollback.

## 📦 Installation

```bash
npm install -g nebula-cli
```

## 🛠 Usage

Simply prefix your commands with `nebula` or enter the interactive shell:

```bash
# Execute a single command with AI oversight
nebula "deploy to prod"

# Start the interactive session
nebula shell
```

## 🤝 Contributing

We follow **Conventional Commits** and strict CI/CD pipelines.

1.  Fork & Clone
2.  `npm install`
3.  `npm test`
4.  Submit a PR with `feat:` or `fix:` messages.

## 📄 License

MIT © 2025 Sagar
