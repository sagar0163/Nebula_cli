import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const AUDIT_DIR = process.env.NEBULA_AUDIT_DIR || path.join(os.homedir(), '.nebula', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'audit.jsonl');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function getAuditFilePath() {
    return AUDIT_FILE;
}

export function getAuditDir() {
    return AUDIT_DIR;
}

/**
 * Appends a single audit entry to the JSONL audit log.
 * @param {object} entry - The audit entry to log.
 */
export function appendAuditEntry(entry) {
    ensureDir(AUDIT_DIR);
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(AUDIT_FILE, line, 'utf8');
}

/**
 * Logs a command execution event.
 * @param {object} data
 * @param {string} data.command - The command executed.
 * @param {string} data.risk - Risk level (none|low|medium|high|critical).
 * @param {string} data.outcome - Outcome (approved|blocked|dry-run|success|failed|cancelled).
 * @param {number} [data.score] - Optional safety score 0-100.
 * @param {string} [data.cwd] - Working directory.
 * @param {string} [data.message] - Optional context message.
 * @returns {string} - The id of the created entry.
 */
export function logAudit({ command, risk, outcome, score, cwd = process.cwd(), message = '' }) {
    const entry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user: os.userInfo().username,
        hostname: os.hostname(),
        command,
        risk: risk || 'unknown',
        score: typeof score === 'number' ? score : null,
        outcome,
        cwd,
        message,
    };
    appendAuditEntry(entry);
    return entry.id;
}

/**
 * Reads all audit entries from the log file.
 * @returns {Array<object>} - All audit entries.
 */
export function readAuditEntries() {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
    return lines.map((line) => {
        try {
            return JSON.parse(line);
        } catch (_e) {
            return null;
        }
    }).filter(Boolean);
}

/**
 * Queries audit entries with optional filters.
 * @param {object} [options]
 * @param {string} [options.command] - Substring match on command.
 * @param {string} [options.risk] - Exact risk level.
 * @param {string} [options.outcome] - Exact outcome.
 * @param {string} [options.user] - Exact username.
 * @param {string} [options.since] - ISO date string (inclusive).
 * @param {string} [options.until] - ISO date string (inclusive).
 * @param {number} [options.limit=100] - Max results to return.
 * @returns {Array<object>} - Matching entries, newest first.
 */
export function queryAudit(options = {}) {
    let entries = readAuditEntries();

    if (options.command) {
        entries = entries.filter((e) => e.command && e.command.includes(options.command));
    }
    if (options.risk) {
        entries = entries.filter((e) => e.risk === options.risk);
    }
    if (options.outcome) {
        entries = entries.filter((e) => e.outcome === options.outcome);
    }
    if (options.user) {
        entries = entries.filter((e) => e.user === options.user);
    }
    if (options.since) {
        entries = entries.filter((e) => e.timestamp >= options.since);
    }
    if (options.until) {
        entries = entries.filter((e) => e.timestamp <= options.until);
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries.slice(0, options.limit || 100);
}

/**
 * Exports audit entries to a file (JSON or CSV based on extension).
 * @param {object} [options]
 * @param {string} [options.format] - 'json' | 'csv'.
 * @param {string} [options.output] - Output file path.
 * @param {object} [options.filters] - Same filters as queryAudit.
 * @returns {string} - Path to the exported file.
 */
export function exportAudit({ format = 'json', output, filters = {} } = {}) {
    const entries = queryAudit(filters);
    const finalFormat = format.toLowerCase() === 'csv' ? 'csv' : 'json';
    ensureDir(AUDIT_DIR);

    const filePath = output || path.join(AUDIT_DIR, `audit-export-${Date.now()}.${finalFormat}`);

    if (finalFormat === 'csv') {
        if (entries.length === 0) {
            fs.writeFileSync(filePath, '', 'utf8');
            return filePath;
        }
        const headers = Object.keys(entries[0]);
        const rows = entries.map((e) =>
            headers.map((h) => {
                const v = e[h];
                if (v === null || v === undefined) return '';
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        fs.writeFileSync(filePath, csv + '\n', 'utf8');
    } else {
        fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
    }

    return filePath;
}

const AuditLogger = {
    log: logAudit,
    query: queryAudit,
    export: exportAudit,
    readAll: readAuditEntries,
    getFilePath: getAuditFilePath,
    getDir: getAuditDir,
};

export default AuditLogger;