# Nebula-CLI: The Self-Healing Terminal Agent

> [!CAUTION]
> **🚧 UNDER ACTIVE DEVELOPMENT 🚧**
> 
> This project is currently in an experimental **Alpha** state. You may encounter:
> *   Frequent crashes or unexpected behavior.
> *   Breaking changes between minor versions.
> *   Hallucinations in AI responses.
> 
> **Use with caution in production environments.**

## 📋 Prerequisites (For Developers)

If you are cloning this repository to build or contribute, ensure you have:

*   **Node.js**: v18.0.0 or higher (Required for ESM support).
*   **Git**: Latest version.
*   **Ollama**: (Optional) For running active local models.
*   **API Keys**: See Configuration section below for Cloud AI access.

![Nebula-CLI](https://via.placeholder.com/800x200?text=Nebula-CLI+The+Self-Healing+Terminal+Agent)

> **"A terminal so smart, it fixes itself before you even notice."**

Nebula-CLI is a next-generation terminal agent powered by LLMs (Gemini/Ollama). It doesn't just run commands; it understands your intent, detects failures, and auto-corrects errors in real-time. Whether you're managing Kubernetes clusters or debugging a local Node.js app, Nebula is your silent partner in engineering.

## 🚀 Architecture

Nebula operates as an intelligent layer between you and the OS kernel.

```mermaid
graph TD
    User[User Input] -->|Command| Shell[Nebula Shell]
    Shell -->|Execute/Monitor| Executioner[Dynamic Executioner]
    Executioner -->|Output stream| Monitor[Activity Monitor]
    Monitor -->|Failure Detected| AI[AI Engine (Gemini/Groq)]
    AI -->|Fix Suggestion| Shell
    Shell -->|Safe-Guard Check| OS[Operating System]
```

## ✨ Key Features

### 🌍 Universal Project Understanding
Nebula instantly recognizes what you are working on and adapts its behavior.
*   **Projects**: Helm, RPM, OpenShift, Docker, Terraform, Ansible, Node.js, Generic K8s.
*   **Environments**: Automatically detects **Minikube**, **EKS**, **GKE**, **OpenShift**, or **AKS**.
*   **Result**: It generates `aws eks update-kubeconfig` for EKS, but `minikube dashboard` for local dev.

### 🧠 "Memento" Short-Term Memory
Nebula remembers what you did 5 minutes ago.
*   **Context Aware**: "fix it" knows *exactly* which error just happened.
*   **Loop Prevention**: Stops suggesting the same failed command twice.
*   **Learning**: Adjusts future suggestions based on your command history.

### 🛡️ Runtime Guards & Safety
*   **Look Before You Leap**: Automatically checks Kubernetes connectivity, namespace existence, and missing secrets *before* running deployment commands.
*   **Red-Line Warnings**: Highlights destructive commands (`rm -rf`, `kubectl delete`, `drop table`) in **RED** and demands confirmation.
*   **Safe Execution**: Never runs AI commands without your explicit "Yes".

### ⏱️ Dynamic Execution Engine
*   **Smart Timeouts**: Knows that `ls` takes 1s but `docker build` needs 10m.
*   **Live Feedback**: Real-time progress monitoring (`🔄 156KB | 🟢 Active`) instead of frozen screens.
*   **Hung Process Detection**: Warns you if a process stops generating output (`🟡 Stalled`).

## 📦 Installation

```bash
npm install -g nebula-cli
```

## 🔧 Configuration

Configure Nebula via `.env` file or environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API Key (Required for Cloud AI) | - |
| `GEMINI_MODEL` | Gemini Model ID | `gemini-2.0-flash` |
| `GROQ_API_KEY` | Groq API Key (Alternative Cloud AI) | - |
| `OLLAMA_MODEL` | Local LLM Model Name | `llama3.2` |

## 🛠 Usage

### 1. Interactive Mode (Recommended)
Enter the persistent, self-healing shell:
```bash
nebula
```
*   **Ask Anything**: `ask "deploy this helm chart to tyk ns"`
*   **Auto-Healing**: If a command fails, Nebula analyzes the error and suggests a fix.
*   **Universal**: Switch from a Node.js project to a K8s cluster seamlessly.

### 2. DevOps Automation
```bash
# Detects project type and suggests next steps
nebula predict

# Analyzes complex failures
nebula ask "why is my pod crashlooping?"
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
