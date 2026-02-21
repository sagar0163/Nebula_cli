// Comprehensive list of destructive/dangerous commands
import parser from 'bash-parser';

// Comprehensive list of destructive/dangerous commands
export const CRITICAL_COMMANDS = [
    /chmod\s+-R\s+777/,                  // Recursive unsafe permissions
    /chown\s+-R/,                        // Recursive ownership change
    /dd\s+if=/,                          // Disk destruction
    /mkfs/,                              // Format filesystem
    />\s*\/dev\/sda/,                    // Overwrite disk
    /:(){:|:&};:/,                       // Fork bomb

    // Kubernetes destruction
    /kubectl\s+delete/,                  // Delete resources
    /kubectl\s+scale\s+--replicas=0/,    // Scale down to zero
    /helm\s+uninstall/,                  // Uninstall charts
    /helm\s+delete/,                     // Legacy delete

    // Docker destruction
    /docker\s+rm/,                       // Remove container
    /docker\s+rmi/,                      // Remove image
    /docker\s+system\s+prune/,           // Prune system
    /docker\s+kill/,                     // Kill container

    // Database destruction
    /drop\s+table/i,                     // Drop table
    /truncate\s+table/i,                 // Truncate table
    /delete\s+from/i,                    // Delete rows
    /drop\s+database/i,                  // Drop database

    // Git destruction
    /git\s+reset\s+--hard/,              // Hard reset
    /git\s+clean\s+-fdx/,                // Force clean
    /git\s+push\s+.*--force/,            // Force push

    // Secret Leakage Prevention [NEW]
    /echo\s+\$[A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)/i, // Echoing secrets
    /^printenv/,                         // Dump all env vars
    /^env$/,                             // Dump all env vars

    // Advanced K8s Protection [NEW]
    /kubectl\s+delete\s+(ns|namespace)\s+(kube-system|default|kube-public|monitoring)/ // System NS nuke
];

// Safe read-only patterns for auto-execution
export const READ_PATTERNS = [
    /^ls\s*(-la|-l|-a)?$/,
    /^cat\s+(README|values|secret|pg|myorg|Chart)/i,
    /^kubectl\s+get\s+(pods?|ns?|deployments?|secrets?|services?|svc|configmaps?|cm)/,
    /^helm\s+list/,
    /^git\s+status/,
    /^docker\s+ps/,
    /^minikube\s+status/
];

/**
 * Scans a command for dangerous operations.
 * @param {string} command - The command to check.
 * @returns {boolean} - True if the command is safe, false if it matches critical patterns.
 */
/**
 * Scans a command for dangerous operations using AST parsing.
 * @param {string} command - The command to check.
 * @returns {boolean} - True if the command is safe, false if it contains critical commands.
 */
export const isSafeCommand = (command) => {
    try {
        // Quick check for command chaining patterns before AST parsing
        const commandChainingPattern = /[;&|]{2}|(^|[^\\])\s*;\s/;
        if (commandChainingPattern.test(command)) {
            return false; // Block command injection attempts
        }
        
        // Check for path traversal attempts
        const pathTraversalPattern = /\.\.\/|\.\.\\/;
        if (pathTraversalPattern.test(command)) {
            return false; // Block path traversal
        }
        
        const ast = parser(command);

        // v5.1.0 - Chaos Hardened
        const DANGEROUS_EXEC = new Set([
            'crontab', 'at', 'systemctl', 'service', 'systemd',
            'node', 'php', 'java', 'gcc', 'python', 'perl', 'ruby',
            'bash', 'sh', 'zsh', 'env', 'printenv', 'sudo', 'su'
        ]);

        const DANGEROUS_BINARIES = new Set([
            'rm', 'kubectl', 'docker', 'helm', 'chmod', 'chown', 'dd', 'mkfs', 'git'
        ]);

        function scanNode(node, depth = 0) {
            if (depth > 20) throw new Error('Recursion depth exceeded');
            if (!node) return true;

            // 0. Universal Expansion Block (Chaos Hardened)
            // Any expansion ($(..), $VAR, `...`) implies execution or variable access.
            if (node.expansion && node.expansion.length > 0) {
                return false;
            }

            // Block indirect executors & Destructive Binaries
            if (node.type === 'Command') {
                // 0. Block Dynamic Command Names (Fixes Deep Nesting/Command Injection via output)
                // If the command name relies on expansion (e.g. $(...), $VAR), it's unsafe.
                if (node.name && node.name.expansion && node.name.expansion.length > 0) {
                    return false;
                }

                const cmdName = node.name?.text;

                if (cmdName) {
                    // 1. Indirect Executors (Chaos Fix)
                    if (DANGEROUS_EXEC.has(cmdName)) {
                        // Allow 'node' without '-e' (e.g. node script.js)
                        if (cmdName === 'node') {
                            if (node.suffix?.some(s => s.text?.includes('-e'))) return false;
                            // Otherwise safe-ish? But node script.js could be malicious.
                            // User patch allowed it. Keeping consistent with patch.
                        } else {
                            return false;
                        }
                    }

                    // 2. Direct Destructive Binaries (Original Guard)
                    if (DANGEROUS_BINARIES.has(cmdName)) {
                        if (cmdName === 'rm') {
                            // Block if ANY arg starts with -r or -f or is a variable expansion
                            const hasBadArg = node.suffix?.some(s => {
                                const t = s.text;
                                return t && (t.startsWith('-r') || t.startsWith('-f') || t.startsWith('$'));
                            });
                            if (hasBadArg) return false;
                        }
                        else if (cmdName === 'kubectl') {
                            if (node.suffix?.some(s => s.text === 'delete')) return false;
                        }
                        else if (cmdName === 'docker') {
                            if (node.suffix?.some(s => ['rm', 'rmi', 'kill', 'system'].includes(s.text))) return false;
                        }
                        else if (cmdName === 'helm') {
                            // Block only explicit destruction
                            if (node.suffix?.some(s => ['uninstall', 'delete', 'rollback'].includes(s.text))) return false;
                        }
                        else if (cmdName === 'git') {
                            // Block destructive git commands
                            const dangerousGitCommands = ['reset', 'clean', 'push'];
                            const gitSubcommand = node.suffix?.[0]?.text;
                            
                            if (gitSubcommand === 'reset' && node.suffix?.some(s => s.text?.includes('--hard'))) {
                                return false; // Block git reset --hard
                            }
                            if (gitSubcommand === 'clean' && node.suffix?.some(s => s.text?.includes('-f'))) {
                                return false; // Block git clean -f
                            }
                            if (gitSubcommand === 'push' && node.suffix?.some(s => s.text?.includes('--force'))) {
                                return false; // Block git push --force
                            }
                            // Allow safe git commands (status, log, diff, branch, etc.)
                            return true;
                        }
                        else {
                            return false; // Default block for others
                        }
                    }

                    // 3. Variable Expansion (Phase 1 Fix)
                    if (cmdName.startsWith('$')) return false;
                }
            }

            // 4. Block Risky Redirects (Systemd/Cron writes)
            if (node.type === 'Redirect') {
                const target = node.file?.text;
                if (target) {
                    if (target.includes('/etc/') || target.endsWith('.service') || target.endsWith('.cron') || target.includes('/bin/')) {
                        return false;
                    }
                }
            }

            // Recursive deep scan (Full Coverage)
            // Using Object.values ensures we don't miss 'redirects', 'expansion', 'parts', etc.
            for (const child of Object.values(node)) {
                if (Array.isArray(child)) {
                    for (const sub of child) {
                        if (sub && typeof sub === 'object') {
                            if (!scanNode(sub, depth + 1)) return false;
                        }
                    }
                } else if (child && typeof child === 'object') {
                    if (!scanNode(child, depth + 1)) return false;
                }
            }

            return true;
        }

        return scanNode(ast);
    } catch (e) {
        // Fail Closed on Parser Error (Chaos Hardened)
        // If we cannot parse it, we cannot trust it.
        return false;
    }
};

/**
 * Returns a warning message if the command is dangerous.
 * @param {string} command - The command to check.
 * @returns {string|null} - Warning message or null.
 */
export const getCommandWarning = (command) => {
    // Explicit Safe Verbs Whitelist (Refined Guardrail)
    const SAFE_VERBS = ['get', 'describe', 'find', 'list', 'status'];
    if (SAFE_VERBS.some(verb => command.includes(verb))) {
        return null; // Explicitly safe
    }

    if (CRITICAL_COMMANDS.some(pattern => pattern.test(command)) || !isSafeCommand(command)) {
        return `⚠️ DANGER: Destructive command detected!`;
    }
    return null;
};

/**
 * Determines the execution mode for a command.
 * @param {string} command - The command to check.
 * @returns {'AUTO'|'BLOCKED'|'MANUAL'} - The execution mode.
 */
export const autonomyMode = (command) => {
    if (READ_PATTERNS.some(p => p.test(command))) {
        return 'AUTO';  // Run + store
    }
    if (!isSafeCommand(command)) {
        return 'BLOCKED';  // Danger!
    }
    return 'MANUAL';  // User executes
};
