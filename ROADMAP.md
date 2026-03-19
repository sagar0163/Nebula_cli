# Nebula-CLI Roadmap

> Strategic roadmap to make Nebula-CLI competitive with best-in-class CLI tools

---

# Executive Summary

This document outlines a strategic roadmap to evolve Nebula-CLI from an experimental project into a production-ready, best-in-class AI terminal agent. The roadmap is based on competitive analysis of leading CLI frameworks (Commander, Yargs, oclif) and AI coding assistants (GitHub Copilot CLI, Aider, Warp AI).

---

# Competitive Analysis

## Where Nebula-CLI Stands Today

### ✅ Strengths

| Feature | Status | Notes |
|---------|--------|-------|
| **Self-Healing** | ✅ Excellent | Core differentiator - auto-detects and fixes failures |
| **Multi-Provider AI** | ✅ Good | Supports Gemini, Groq, Ollama |
| **Security Hardening** | ✅ Excellent | AST traversal, fail-closed, project isolation |
| **Interactive Shell** | ✅ Good | Advanced session mode with predictions |
| **Project Awareness** | ✅ Good | DNA fingerprinting, context-aware commands |
| **Vector Memory** | ✅ Good | Remembers past fixes |

### ⚠️ Areas to Improve

| Feature | Current State | Gap |
|---------|---------------|-----|
| **CLI Framework** | Custom implementation | oclif/Commander have better UX |
| **Documentation** | Basic | Need comprehensive guides |
| **Plugin System** | None | Need extensibility |
| **Interactive Prompts** | Basic inquirer | Could be more polished |
| **Shell Completions** | None | Critical for DX |
| **Configuration** | .env based | Need YAML/TOML support |
| **Testing** | Unit + Integration | Need E2E tests |
| **CI/CD** | Basic GitHub Actions | Need better pipelines |

## Competitive Comparison

### vs GitHub Copilot CLI

| Feature | Copilot CLI | Nebula-CLI | Priority |
|---------|-------------|------------|----------|
| Agentic workflows | ✅ | ⚠️ Basic | HIGH |
| Shell integration | ✅ | ✅ | - |
| GitHub ecosystem | ✅ Native | ❌ None | MEDIUM |
| Self-healing | ❌ | ✅ **Better** | KEEP |
| Local models | ⚠️ Limited | ✅ Better | KEEP |
| Privacy | ⚠️ Cloud-first | ✅ Better | KEEP |

### vs oclif (Salesforce CLI Framework)

| Feature | oclif | Nebula-CLI | Priority |
|---------|-------|------------|----------|
| Plugin system | ✅ Excellent | ❌ None | HIGH |
| Autocomplete | ✅ Built-in | ❌ None | HIGH |
| Documentation | ✅ Excellent | ⚠️ Basic | MEDIUM |
| Publishing | ✅ Built-in | ❌ None | LOW |

### vs Aider (AI Coding Assistant)

| Feature | Aider | Nebula-CLI | Priority |
|---------|-------|------------|----------|
| Edit-in-place | ✅ | ❌ None | HIGH |
| Git integration | ✅ Excellent | ⚠️ Basic | MEDIUM |
| Multi-file edits | ✅ | ❌ None | HIGH |

---

# Roadmap: Phased Approach

## Phase 1: Foundation (v5.5.0 - v5.6.0)
*Weeks 1-4: Critical infrastructure*

### Goals
- [ ] Improve CLI argument parsing (adopt Commander.js or oclif)
- [ ] Add shell completions (bash, zsh, fish)
- [ ] Better error messages and help text
- [ ] Configuration file support (YAML)

### Deliverables

#### 1.1 CLI Framework Migration
```bash
# Migrate from custom parsing to Commander.js
# Benefits: autocomplete, better help, aliases
```

#### 1.2 Shell Completions
```bash
# Add completions for
# - nebula <tab>
# - nebula ask <tab>
# - nebula --<tab>
```

#### 1.3 Configuration Files
```yaml
# ~/.nebula.yaml
providers:
  gemini:
    key: ${GEMINI_API_KEY}
  ollama:
    url: http://localhost:11434
```

---

## Phase 2: Developer Experience (v5.7.0 - v6.0.0)
*Weeks 5-12: DX improvements*

### Goals
- [ ] Plugin system
- [ ] Interactive prompts (repl)
- [ ] Better documentation website
- [ ] GitHub integration

### Deliverables

#### 2.1 Plugin System
```javascript
// nebula-plugin-docker
// nebula-plugin-kubernetes
// nebula-plugin-git

// Usage
nebula plugin install nebula-plugin-docker
```

#### 2.2 REPL Mode
```bash
# Interactive REPL with AI
nebula repl
> fix this buggy function
> explain what this command does
> optimize this code
```

#### 2.3 GitHub Integration
```bash
# Create PR from terminal
nebula pr create --title "Fix login bug" --body "AI-generated fix"
```

---

## Phase 3: AI Enhancements (v6.1.0 - v6.5.0)
*Weeks 13-24: AI improvements*

### Goals
- [ ] Edit-in-place (like Aider)
- [ ] Multi-file AI edits
- [ ] Better context window
- [ ] Streaming responses

### Deliverables

#### 3.1 In-Place Editing
```bash
# Edit file directly
nebula edit src/utils.js --refactor "use arrow functions"
```

#### 3.2 Multi-File Changes
```bash
# AI refactors across files
nebula refactor --scope "src/**/*.js" --pattern "var -> let"
```

#### 3.3 Context Awareness
```bash
# Load project context
nebula analyze --project
# Remembers: tech stack, dependencies, patterns
```

---

## Phase 4: Ecosystem (v7.0.0+)
*Months 7+: Build ecosystem*

### Goals
- [ ] VS Code extension
- [ ] JetBrains plugin
- [ ] Community plugins
- [ ] npm package

### Deliverables

#### 4.1 IDE Integration
```vscode
// VS Code extension
// Run Nebula directly from VS Code terminal
```

#### 4.2 Community
- Create nebula-plugin-template
- Discord community
- npm organization

---

# Technical Debt

## Immediate (This Sprint)

| Issue | Impact | Effort |
|-------|--------|--------|
| Remove 74 lint warnings | Low | 2h |
| Fix 11 security vulnerabilities | High | 4h |
| Add TypeScript | Medium | 1 week |

## Short-term (1-2 months)

| Issue | Impact | Effort |
|-------|--------|--------|
| Migrate to Commander.js | Medium | 1 week |
| Add shell completions | High | 1 week |
| Configuration file support | Medium | 3 days |

## Long-term (3-6 months)

| Issue | Impact | Effort |
|-------|--------|--------|
| Plugin system | High | 1 month |
| Full TypeScript rewrite | High | 2 months |

---

# Feature Priorities Matrix

## Must Have (P0)

1. **Shell Completions** - Without this, CLI feels broken
2. **Configuration Files** - env vars are not enough
3. **Better Error Messages** - First impression matters
4. **Fix 11 Security Vulnerabilities** - Safety first

## Should Have (P1)

5. **Plugin System** - Extensibility
6. **GitHub Integration** - Workflow
7. **Edit-in-Place** - Core AI functionality
8. **Documentation Website** - Adoption

## Nice to Have (P2)

9. **VS Code Extension** - IDE integration
10. **REPL Mode** - Interactive AI chat
11. **Web UI** - Alternative interface

---

# Success Metrics

## By Version 6.0

- [ ] 1000+ npm downloads/month
- [ ] 100+ GitHub stars
- [ ] 10+ community plugins
- [ ] < 10 lint warnings
- [ ] 0 security vulnerabilities
- [ ] Shell completions working

## By Version 7.0

- [ ] 10,000+ npm downloads/month
- [ ] 500+ GitHub stars
- [ ] 50+ community plugins
- [ ] IDE integrations (VS Code, JetBrains)
- [ ] Active Discord community

---

# Competitor Feature Matrix

| Feature | Nebula (current) | Nebula (v6) | Copilot CLI | oclif | Aider |
|---------|------------------|-------------|-------------|-------|-------|
| Self-healing | ✅ | ✅ | ❌ | ❌ | ❌ |
| Shell completions | ❌ | ✅ | ✅ | ✅ | N/A |
| Plugin system | ❌ | ✅ | ✅ | ✅ | ❌ |
| Edit-in-place | ❌ | ✅ | ✅ | N/A | ✅ |
| Local models | ✅ | ✅ | ⚠️ | N/A | ✅ |
| Config files | ❌ | ✅ | ✅ | ✅ | N/A |
| Git integration | ❌ | ✅ | ✅ | ✅ | ✅ |
| TypeScript | ❌ | ✅ | ✅ | ✅ | ✅ |

---

# Action Items

## This Week

1. [ ] Fix 11 security vulnerabilities
2. [ ] Reduce lint warnings to < 10
3. [ ] Add shell completion stub

## This Month

1. [ ] Plan plugin architecture
2. [ ] Add YAML config support
3. [ ] Create documentation website structure

## This Quarter

1. [ ] Release v5.5.0 with completions
2. [ ] Release v6.0.0 with plugin system
3. [ ] Launch documentation website

---

*Last updated: 2026-03-19*
*Generated based on competitive analysis*
