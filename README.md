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

## 🧠 AI Setup (The "Brain")

Nebula uses a hybrid approach: **Privacy-First (Ollama)** for local tasks, and **Cloud (Gemini)** for complex reasoning.

### 1. Local AI (Ollama)
Install [Ollama](https://ollama.com/) and pull the Llama 3 model:
```bash
ollama pull llama3
```

### 2. Cloud AI (Gemini)
Get your API key from [Google AI Studio](https://aistudio.google.com/).
```bash
export GEMINI_API_KEY="your_api_key_here"
```

## 🛠 Usage

### 1. Interactive Mode (Recommended)
Enter the persistent, self-healing shell:
```bash
nebula
# or
nebula session
```
*   **Persistent Prompt**: `nebula 🌌>`
*   **Stateful**: Tracks directory changes (`cd`) and history.
*   **Auto-Healing**: Automatically suggests fixes for any failed command in the session.

### 2. One-Shot Mode
Prefix your commands with `nebula` for a single execution:
```bash
# Example: Permission error?
nebula "mkdir /root/forbidden_folder"

# Nebula: 🤖 Analyzing... 
# 💡 Suggested Fix: sudo mkdir /root/forbidden_folder
# Execute this fix? (y/N)
```

## 🛡️ Safety & Privacy

### Human-in-the-Loop
Nebula is designed as a **copilot**, not an autopilot.
*   **Explicit Consent**: Nebula will NEVER execute an AI-suggested command without your explicit "y/N" confirmation.
*   **Review First**: Always read the suggested fix before hitting 'y'.

### Privacy Warning (Free Tier)
If you are using the free tier of Gemini or other public LLM providers:
*   **Data Usage**: Your command history and error logs may be processed by human reviewers to improve the model.
*   **Sensitive Data**: **DO NOT** use Nebula with secrets, API keys, or PII (Personally Identifiable Information) in the terminal output when using public models.

## ⚠️ Disclaimer

**Experimental Technology**: Nebula-CLI uses large language models which can be unpredictable.
*   **Hallucinations**: The AI may suggest commands that do not exist or do not solve the problem.
*   **Liability**: You are responsible for the commands executed on your machine. The authors of Nebula-CLI are not liable for any data loss or system damage.

## 🤝 Contributing

We follow **Conventional Commits** and strict CI/CD pipelines.

1.  Fork & Clone
2.  `npm install`
3.  `npm test`
4.  Submit a PR with `feat:` or `fix:` messages.

## 📄 License

MIT © 2025 Sagar
