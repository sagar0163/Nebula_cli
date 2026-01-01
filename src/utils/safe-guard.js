// Comprehensive list of destructive/dangerous commands
export const CRITICAL_COMMANDS = [
    // Filesystem destruction
    /rm\s+(-r|--recursive)?f/,           // Force remove
    /rm\s+(-r|--recursive)/,             // Recursive remove
    /chmod\s+777/,                       // Unsafe permissions
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
    /git\s+push\s+.*--force/             // Force push
];

/**
 * Scans a command for dangerous operations.
 * @param {string} command - The command to check.
 * @returns {boolean} - True if the command is safe, false if it matches critical patterns.
 */
export const isSafeCommand = (command) => {
    return !CRITICAL_COMMANDS.some(pattern => pattern.test(command));
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
