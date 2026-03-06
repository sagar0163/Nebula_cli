// Anonymous Telemetry for Nebula-CLI
// Opt-in usage tracking - can be disabled via NEBULA_TELEMETRY=0

import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if telemetry is disabled
const TELEMETRY_ENABLED = process.env.NEBULA_TELEMETRY !== '0' && process.env.NEBULA_TELEMETRY !== 'false';

// Get or create anonymous user ID
function getUserId() {
    const idFile = path.join(os.homedir(), '.nebula-cli', 'telemetry-id');
    
    if (fs.existsSync(idFile)) {
        return fs.readFileSync(idFile, 'utf-8').trim();
    }
    
    // Generate new anonymous ID
    const id = crypto.randomUUID();
    const dir = path.dirname(idFile);
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(idFile, id);
    return id;
}

/**
 * Track an event (anonymous)
 */
export function track(event, properties = {}) {
    if (!TELEMETRY_ENABLED) return;
    
    const payload = {
        event,
        properties: {
            ...properties,
            version: '5.4.1',
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
        },
        userId: getUserId(),
    };
    
    // Log locally (in production, would send to analytics)
    const logFile = path.join(os.homedir(), '.nebula-cli', 'telemetry.log');
    const dir = path.dirname(logFile);
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.appendFileSync(logFile, JSON.stringify(payload) + '\n');
}

/**
 * Track command usage
 */
export function trackCommand(command) {
    track('command_used', { command });
}

/**
 * Track AI provider usage
 */
export function trackProvider(provider, success) {
    track('provider_used', { provider, success });
}

/**
 * Track error
 */
export function trackError(errorType, message) {
    track('error', { type: errorType, message: String(message).slice(0, 200) });
}

/**
 * Get telemetry status
 */
export function isEnabled() {
    return TELEMETRY_ENABLED;
}

export default {
    track,
    trackCommand,
    trackProvider,
    trackError,
    isEnabled,
};
