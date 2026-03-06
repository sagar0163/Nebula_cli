// Custom Error Classes for Nebula-CLI

export class NebulaError extends Error {
    constructor(message, code = 'UNKNOWN', details = {}) {
        super(message);
        this.name = 'NebulaError';
        this.code = code;
        this.details = details;
    }
}

export class ConfigurationError extends NebulaError {
    constructor(message, details = {}) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigurationError';
    }
}

export class AIProviderError extends NebulaError {
    constructor(provider, message, details = {}) {
        super(`AI Provider (${provider}): ${message}`, 'AI_PROVIDER_ERROR', { provider, ...details });
        this.name = 'AIProviderError';
    }
}

export class ExecutionError extends NebulaError {
    constructor(command, message, details = {}) {
        super(`Command failed: ${command} - ${message}`, 'EXECUTION_ERROR', { command, ...details });
        this.name = 'ExecutionError';
    }
}

export class SecurityError extends NebulaError {
    constructor(message, details = {}) {
        super(`Security violation: ${message}`, 'SECURITY_ERROR', details);
        this.name = 'SecurityError';
    }
}

export class ValidationError extends NebulaError {
    constructor(message, field, details = {}) {
        super(`Validation failed: ${message}`, 'VALIDATION_ERROR', { field, ...details });
        this.name = 'ValidationError';
    }
}

/**
 * Format error for display
 */
export function formatError(error) {
    const chalk = require('chalk');
    
    let message = chalk.red('❌ ');
    
    if (error.name) {
        message += chalk.bold(`${error.name}: `);
    }
    
    message += error.message;
    
    if (error.code) {
        message += chalk.gray(` [${error.code}]`);
    }
    
    if (error.details && Object.keys(error.details).length > 0) {
        message += '\n' + chalk.gray(JSON.stringify(error.details, null, 2));
    }
    
    return message;
}

export default {
    NebulaError,
    ConfigurationError,
    AIProviderError,
    ExecutionError,
    SecurityError,
    ValidationError,
    formatError,
};
