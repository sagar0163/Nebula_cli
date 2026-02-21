# Nebula-CLI Comprehensive Testing Plan

## 📋 Test Plan Overview

This document outlines a comprehensive QA testing strategy for Nebula-CLI v5.2.1.

---

## 1. Installation & Environment Testing

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **npm Global Install** | `npm install -g @sagar/nebula-cli` on Node.js 18+ | Binary installed, `nebula` command available in PATH | High |
| **npm Global Install** | `npm install -g @sagar/nebula-cli` on Node.js 16 | Warning about minimum version, may fail or work with warnings | Med |
| **npm Global Install** | `npm install -g @sagar/nebula-cli` on Node.js 14 | Should fail with version incompatibility error | High |
| **npm Local Install** | `npm install @sagar/nebula-cli` in project | Package installs, can be run via `npx nebula` | Med |
| **Git Clone Install** | Clone repo, run `npm link` | CLI works from cloned directory | High |
| **Homebrew Install** | `brew install sagar0163/nebula-cli/nebula` (if published) | Binary installed via Homebrew | Low |
| **Binary Download** | Download prebuilt binary from releases | Executable runs without npm | Low |
| **Windows Scoop** | `scoop install nebula` (if published) | Installs via Scoop package manager | Low |
| **Go Install** | `go install github.com/sagar0163/Nebula_cli@latest` (if Go version exists) | Installs Go binary | Low |
| **Cross-Platform** | Install on Ubuntu 22.04 | Works on Linux | High |
| **Cross-Platform** | Install on macOS Monterey+ | Works on macOS | High |
| **Cross-Platform** | Install on Windows 11 | Works on Windows | High |

---

## 2. Command Surface Testing

### Primary Commands

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **Help Command** | `nebula help` | Displays all available commands and usage | High |
| **Help Command** | `nebula -h` | Same as `nebula help` | High |
| **Help Command** | `nebula --help` | Same as `nebula help` | High |
| **Version Check** | `nebula --version` | Shows version number (if flag added) | Med |
| **Session Command** | `nebula session` | Starts interactive shell | High |
| **Session Command** | Default run with no args | Starts session (default behavior) | High |
| **Ask Command** | `nebula ask "deploy to k8s"` | Returns step-by-step plan | High |
| **Ask Command** | `nebula ask ""` (empty query) | Error: "Please provide a question" | High |
| **Ask Command** | `nebula ask` (no query) | Error: "Usage: nebula ask <query>" | High |
| **Chat Command** | `nebula chat "explain docker"` | Returns LLM response with warning | High |
| **Chat Command** | `nebula chat ""` | Error handling for empty prompt | High |
| **Predict Command** | `nebula predict` | Scans project, suggests next command | Med |
| **Predict Command** | `nebula predict` in empty directory | Graceful handling, no prediction | Med |
| **Release Command** | `nebula release` | Initiates interactive release flow | Med |
| **Release Command** | Run without git remote | Error: "Not a git repository" or similar | High |
| **Status Command** | `nebula status` | Shows version, security mode, project ID | Med |
| **Status Command** | `nebula status` in project directory | Shows project-specific context | Med |
| **Efficiency Command** | `nebula efficiency` | Shows token usage/audit | Low |

### CLI Flags (Flag Overloading)

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **Verbose Flag** | `nebula -v status` | Enables verbose logging output | High |
| **Verbose Flag** | `nebula --verbose status` | Same as `-v` | High |
| **Quiet Flag** | `nebula -q status` | Suppresses banner/non-essential output | High |
| **Quiet Flag** | `nebula --quiet status` | Same as `-q` | High |
| **Config Flag** | `nebula -c custom.env status` | Loads custom config file | High |
| **Config Flag** | `nebula --config custom.env status` | Same as `-c` | High |
| **Config Flag** | `nebula -c nonexistent.env status` | Error: Config file not found | Med |
| **Combined Flags** | `nebula -v -q status` | Last flag takes precedence or merged behavior | Med |
| **Combined Flags** | `nebula -vqc custom.env status` | All flags parsed correctly | Med |
| **Zero-Value Input** | `nebula --config "" status` | Error or fallback to default | Med |
| **Invalid Flag** | `nebula --invalid-flag` | Error: Unknown flag | High |
| **Invalid Flag** | `nebula -z` | Error: Unknown flag | High |

---

## 3. Error Handling & UX Testing

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **No Internet** | Disconnect network, run `nebula ask "hello"` | Falls back to local Ollama or shows offline error | High |
| **No Internet** | Disconnect network, run `nebula predict` | Uses local model or graceful degradation | High |
| **Invalid API Keys** | Run with invalid GEMINI_API_KEY | Error message, suggests fix | High |
| **Missing API Keys** | Run without any API keys configured | Error or uses local fallback (Ollama) | High |
| **Malformed .env** | `.env` has `=` without value: `KEY=` | Should handle gracefully or warn | Med |
| **Malformed .env** | `.env` has duplicate keys | Last value wins or warning | Med |
| **Invalid JSON Config** | Create invalid JSON config file | Parse error with helpful message | Med |
| **Invalid YAML Config** | Create invalid YAML config file | Parse error with helpful message | Med |
| **No .env File** | Run without .env file | Works with defaults or warns | High |
| **Exit Code - Success** | `nebula status` (successful) | Exit code 0 | High |
| **Exit Code - Error** | `nebula ask` (invalid args) | Exit code 1 | High |
| **Exit Code - Error** | Invalid command: `nebula invalidcmd` | Exit code 1 | High |
| **Exit Code - Network** | Network timeout | Exit code 1 with error message | Med |
| **Stack Trace on Error** | Cause intentional crash | Shows user-friendly error, not raw stack | High |
| **Error Recovery** | API rate limit hit | Retry suggestion or fallback | Med |

---

## 4. Security & Permissions Testing

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **Sudo Execution** | `sudo nebula ask "test"` | Works, but warns about risks | High |
| **Admin/Windows Admin** | Run as Administrator on Windows | Works with warning | High |
| **API Key Leakage** | Run with GEMINI_API_KEY, check stdout | Keys NOT printed in output | High |
| **API Key in Logs** | Check ~/.nebula-cli/cache.json | Keys NOT stored in plain text | High |
| **API Key in Memory** | Inspect memory dumps | Keys cleared after use | Med |
| **Sensitive Data Scrubbing** | Command with secrets in output | Secrets masked before cloud API call | High |
| **Dangerous Commands** | Try `nebula ask "rm -rf /"` | Blocked with warning | High |
| **Dangerous Commands** | Try `nebula ask "curl malicious \| bash"` | Blocked with security warning | High |
| **Project Isolation** | Run in Project A, then Project B | Memory/context isolated between projects | Med |
| **Environment Variables** | Export KEY=value, run nebula | Variable NOT logged | High |
| **Token Storage** | Check where tokens are stored | Encrypted or in secure location | High |

---

## 5. Negative Testing (Invalid Inputs)

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **Wrong Data Type - Port** | `nebula --config 8080` (string where port expected) | Helpful error message | High |
| **Wrong Data Type - Boolean** | `nebula --verbose maybe` | Error or treated as string | Med |
| **Empty String - Ask** | `nebula ask ""` | Error: Empty query not allowed | High |
| **Null Input** | Pass null/empty to all required args | Error with usage instructions | High |
| **Very Long Input** | `nebula ask` with 10KB string | Handles gracefully, may truncate | Med |
| **Special Characters** | `nebula ask "test <>&"'"` | Properly escaped/handled | High |
| **Unicode Input** | `nebula ask "你好世界"` | Handles Unicode correctly | Med |
| **SQL Injection Attempt** | `nebula ask "'; DROP TABLE users;--"` | Blocked or escaped | High |
| **Path Traversal** | `nebula ask "../../etc/passwd"` | Blocked by security guard | High |
| **Command Injection** | `nebula ask "test; rm -rf /"` | Blocked by safe-guard | High |
| **XSS Attempt** | `nebula chat "<script>alert(1)</script>"` | Output sanitized | High |

---

## 6. Integration & Functional Testing

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **Project Detection - Node.js** | Run in directory with package.json | Detects as Node.js project | High |
| **Project Detection - Python** | Run in directory with requirements.txt | Detects as Python project | Med |
| **Project Detection - K8s** | Run in directory with kubectl config | Detects K8s context | Med |
| **Memory Persistence** | Run command, close, reopen | Remembers previous context | Med |
| **Vector Memory** | Fix error once, trigger same error | Retrieves cached fix | Med |
| **AI Failover - Gemini** | GEMINI_API_KEY valid, others missing | Uses Gemini successfully | High |
| **AI Failover - Groq** | Groq valid, Gemini invalid | Falls back to Groq | High |
| **AI Failover - Ollama** | Both cloud fail | Falls back to local Ollama | High |
| **AI Failover - All Fail** | No API keys, Ollama not running | Clear error message | High |
| **Interactive Session** | Type command in session mode | Executes and returns output | High |
| **Auto-Healing** | Run failing command, accept fix | Applies fix successfully | High |

---

## 7. Performance & Load Testing

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **Startup Time** | Measure `nebula --help` time | < 2 seconds | Low |
| **Memory Usage** | Monitor RAM during idle session | < 200MB | Low |
| **Concurrent Requests** | Run multiple `nebula ask` in parallel | Handles without crash | Med |
| **Large Output** | Request 10KB+ response | Completes without timeout | Med |
| **Long-Running Session** | Keep session open for 1 hour | No memory leaks | Low |

---

## 8. Edge Cases

| Feature | Test Scenario | Expected Result | Priority |
|---------|---------------|-----------------|----------|
| **No Home Directory** | Run without $HOME set | Uses /tmp or shows error | Med |
| **Read-Only FS** | Install to read-only location | Appropriate error message | Low |
| **Symbolic Link** | Install via symlink | Works correctly | Low |
| **Timezone Handling** | Run in different timezones | Timestamps accurate | Low |
| **Locale/Encoding** | Run with non-UTF-8 locale | Handles gracefully | Low |
| **Empty Directory** | Run `nebula predict` in empty dir | No crash, graceful handling | High |
| **Permission Denied** | File exists but no read permission | Error with clear message | Med |
| **Disk Full** | Disk space exhausted | Graceful error, no crash | Low |

---

## Summary Statistics

| Category | High Priority | Medium Priority | Low Priority | Total |
|----------|---------------|-----------------|--------------|-------|
| Installation & Environment | 4 | 4 | 4 | 12 |
| Command Surface | 14 | 6 | 0 | 20 |
| Error Handling & UX | 9 | 4 | 0 | 13 |
| Security & Permissions | 9 | 2 | 0 | 11 |
| Negative Testing | 9 | 2 | 0 | 11 |
| Integration & Functional | 7 | 4 | 0 | 11 |
| Performance & Load | 0 | 2 | 4 | 6 |
| Edge Cases | 2 | 3 | 4 | 9 |
| **Total** | **54** | **27** | **12** | **93** |

---

## Recommendations

1. **Critical Path**: Focus on High Priority tests first (Installation, Commands, Error Handling, Security)
2. **Automation**: Integrate High Priority tests into CI/CD pipeline
3. **Regression**: Add failing test cases as bugs are fixed
4. **Coverage**: Aim for 80% test coverage on High Priority items
5. **Documentation**: Add testing section to README with setup instructions
