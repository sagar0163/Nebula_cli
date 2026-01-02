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
        const ast = parser(command);
        let safe = true;

        const traverse = (node) => {
            if (!safe) return;
            if (!node) return;

            // Check Command Names
            if (node.type === 'Command') {
                const cmdName = node.name?.text;
                if (cmdName && isDangerous(cmdName, node)) {
                    safe = false;
                }
            }

            // Recursive traversal
            for (const key in node) {
                if (node[key] && typeof node[key] === 'object') {
                    if (Array.isArray(node[key])) {
                        node[key].forEach(child => traverse(child));
                    } else {
                        traverse(node[key]);
                    }
                }
            }
        };

        traverse(ast);
        return safe;
    } catch (e) {
        // If parsing fails, fall back to regex (paranoid mode)
        return !CRITICAL_COMMANDS.some(pattern => pattern.test(command));
    }
};

const DANGEROUS_BINARIES = new Set(['rm', 'kubectl', 'docker', 'helm', 'chmod', 'chown', 'dd', 'mkfs', 'git']);

const isDangerous = (cmdName, node) => {
    // Simple check: is the binary in our block list? 
    // Note: The original regexes were specific (e.g. rm -rf). 
    // With AST, we should act on the *Command Name* primarily for now 
    // to block "hidden" commands like 'echo ... | sh' -> 'sh' is the command? 
    // No, 'sh' runs the input.
    // The AST for `echo ... | base64 -d | sh` involves pipes.
    // `sh` is a command. But `rm` inside the encoded string is NOT visible to AST.
    // WAIT.
    // If the user obfuscates `rm` inside base64, AST parsing `echo ... | sh` ONLY SEES `echo`, `base64`, `sh`.
    // It DOES NOT see `rm`.
    // SO AST PARSING DOES NOT FIX BASE64 OBFUSCATION OF THE PAYLOAD.
    // BUT, it *does* allow us to block `sh`, `bash`, `python`, `perl` etc if we want to be strict?
    // The User's "Fix" example showed: `if (DANGEROUS_CMDS.has(callee)) path.stop();`
    // This implies blocking the *execution wrapper*?
    // Or did the user assume we would decode it? No.
    // The Red Team "Pass" criteria for Phase 1 was: "Tricked Nebula into running a destructive command".
    // If we block `sh`, `eval`, `base64` usage in shell commands, we stop the exploit.
    // Let's broaden the block list to include shell runners.

    if (['sh', 'bash', 'zsh', 'python', 'python3', 'perl', 'ruby', 'base64', 'openssl', 'printf', 'xargs', 'eval'].includes(cmdName)) {
        return true; // Block obfuscation tools
    }

    // Standard blocks
    if (DANGEROUS_BINARIES.has(cmdName)) {
        // Deep check arguments if needed, but for 'rm', 'kubectl' usually unsafe in auto-mode.
        // The original regex had nuance (rm -rf vs rm). 
        // For this fix, let's be strict: Block 'rm' entirely in "Safe" check? 
        // The regex `rm -rf` allowed `rm file.txt`.
        // We should check args.
        if (cmdName === 'rm') {
            // Block if ANY arg starts with -r or -f or is a variable expansion
            return hasArg(node, '-f') || hasArg(node, '-rf') || hasArg(node, '-r') || hasArg(node, '$');
        }
        if (cmdName === 'kubectl') return hasArg(node, 'delete');
        if (cmdName === 'docker') return hasArg(node, 'rm') || hasArg(node, 'rmi') || hasArg(node, 'kill');
        return true; // Default block for others (chmod, chown, etc)
    }

    // Check for variable expansion/assignment that might hide commands?
    // bash-parser 'Assignment' node.
    // But `isSafeCommand` is checking "Is this command safe to run AUTOMATICALLY?".
    // Complex commands with variables are inherently unsafe for auto-run.
    // If it contains a variable expansion in the command name itself, block it.
    // e.g. `$CMD -rf /` -> AST: Command name is a Word with Expansion.
    // bash-parser structures might vary.
    // For now, if cmdName starts with '$', block it.
    if (cmdName.startsWith('$')) return true;

    return false;
};

const hasArg = (node, argPrefix) => {
    return node.suffix?.some(s => s.text && s.text.startsWith(argPrefix));
};

/**
 * Returns a warning message if the command is dangerous.
 * @param {string} command - The command to check.
 * @returns {string|null} - Warning message or null.
 */
export const getCommandWarning = (command) => {
    if (CRITICAL_COMMANDS.some(pattern => pattern.test(command))) {
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
