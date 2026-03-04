# Nebula-CLI Docker Image

A containerized version of Nebula-CLI for secure, isolated AI-assisted terminal operations.

## 🚀 Quick Start

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/sagar0163/nebula-cli:latest

# Run interactively
docker run -it --rm ghcr.io/sagar0163/nebula-cli:latest

# With API keys
docker run -it --rm \
  -e GEMINI_API_KEY=your_key \
  ghcr.io/sagar0163/nebula-cli:latest

# With current directory mounted
docker run -it --rm \
  -v $(pwd):/workspace \
  -e GEMINI_API_KEY=your_key \
  ghcr.io/sagar0163/nebula-cli:latest
```

## 🐳 Docker Compose

```yaml
version: '3.8'

services:
  nebula:
    image: ghcr.io/sagar0163/nebula-cli:latest
    container_name: nebula-cli
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - OLLAMA_MODEL=llama3.2
    volumes:
      - ./workspace:/workspace
      - nebula-memory:/root/.nebula
    stdin_open: true
    tty: true

volumes:
  nebula-memory:
```

Run with:
```bash
docker-compose run --rm nebula
```

## 🔨 Build Locally

```bash
# Build the image
docker build -t nebula-cli:latest .

# Run
docker run -it --rm nebula-cli:latest
```

## 📦 Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Most recent release |
| `v5.4.0` | Specific version |
| `main` | Latest development build |

## 🔐 Security Notes

- API keys should be passed via environment variables
- The container runs with a non-root user
- No shell history is persisted
- Network access is limited to necessary endpoints

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│          nebula-cli                 │
│  ┌─────────────────────────────┐   │
│  │    Node.js 20 (Alpine)    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │     Nebula-CLI Code        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```
