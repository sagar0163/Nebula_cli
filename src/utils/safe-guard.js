export const CRITICAL_COMMANDS = [
    /rm\s+-rf/,
    /kubectl\s+delete/,
    /docker\s+rm/,
    /drop\s+table/i,
    /truncate\s+table/i
];

/**
 * Scans a command for dangerous operations.
 * @param {string} command - The command to check.
 * @returns {boolean} - True if the command is safe, false if it matches critical patterns.
 */
export const isSafeCommand = (command) => {
    return !CRITICAL_COMMANDS.some(pattern => pattern.test(command));
};
