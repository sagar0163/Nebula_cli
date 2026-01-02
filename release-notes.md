# Nebula-CLI v5.1.0 - Chaos Hardened

**Security Patch & Resilience Upgrade**

## 🧠 Feature: Project-Isolated Memory
Nebula now remembers context **per-directory**, ensuring fixes for one project don't pollute another.
*   **Tiered Lookup**: Session Cache (0.1ms) → Project-Specific (90% match) → Global Universal (95% match).
*   **Deep Context**: embeddings are generated using local Ollama (nomic-embed-text).
*   **Data Privacy**: Project memory is namespaced by unique UUID generated from filepath.

## 🛡️ Security Hardening (Chaos Audit)
Successfully remediated 6 critical semantic escape vectors identified during red team stress testing.

*   **Recursive AST Traversal**: Replacing flat scanning with deep recursion (Depth Limit: 20) to prevent nested-shell attacks.
*   **Polyglot Protection**: Hardened against inline Node.js, Python, and Perl execution.
*   **Indirect Execution Block**: Now blocks `crontab`, `at`, `systemd` service creation via pipe injection.
*   **Variable Protection**: Blocks command execution via variable expansion (`$CMD`).

## 📊 Chaos Audit Score
*   **AST Effectiveness**: 100% (12/12 Vectors Blocked)
*   **Context Resilience**: Verified against 50k log lines.
*   **Failover**: Verified against triple-provider outage.
