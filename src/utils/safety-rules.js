import fs from 'fs';
import os from 'os';
import path from 'path';

export const DEFAULT_RULES = {
    environments: {
        development: {
            allowDestructive: true,
            maxScore: 90,
            blockedPatterns: [],
        },
        staging: {
            allowDestructive: false,
            maxScore: 50,
            blockedPatterns: [/drop\s+database/i, /rm\s+-rf\s+\//],
        },
        production: {
            allowDestructive: false,
            maxScore: 30,
            blockedPatterns: [
                /rm\s+-rf\s+\//,
                /mkfs/,
                /dd\s+if=/,
                /drop\s+database/i,
                /truncate\s+table/i,
                /kubectl\s+delete/,
                /git\s+push.*--force/i,
            ],
        },
    },
    defaultEnvironment: 'development',
    sandbox: {
        enabled: false,
        image: 'node:20-alpine',
        network: 'none',
        cpus: '0.5',
        memory: '256m',
    },
    rollback: {
        enabled: true,
        snapshotDir: path.join(os.homedir(), '.nebula', 'snapshots'),
    },
    audit: {
        enabled: true,
        dir: path.join(os.homedir(), '.nebula', 'audit'),
    },
};

function resolveConfigPath(override) {
    if (override) return override;
    const candidates = [
        process.env.NEBULA_SAFETY_CONFIG,
        path.join(process.cwd(), 'nebula-safety.json'),
        path.join(os.homedir(), '.nebula', 'safety.json'),
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(c)) return c;
    }
    return null;
}

export function loadSafetyRules(configPath) {
    const resolved = resolveConfigPath(configPath);
    if (!resolved) {
        return structuredClone(DEFAULT_RULES);
    }
    try {
        const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
        const merged = { ...DEFAULT_RULES, ...raw };
        merged.environments = {
            ...DEFAULT_RULES.environments,
            ...(raw.environments || {}),
        };
        delete merged.defaultEnvironment;
        delete merged.environments.defaultEnvironment;
        merged.defaultEnvironment = raw.defaultEnvironment || DEFAULT_RULES.defaultEnvironment;
        return merged;
    } catch (_e) {
        return structuredClone(DEFAULT_RULES);
    }
}

export function getEnvironment(envName, rules) {
    const effective = envName || process.env.NEBULA_ENV || rules.defaultEnvironment || 'development';
    return rules.environments[effective] || rules.environments.development;
}

function envScoreThreshold(envName, rules) {
    const env = getEnvironment(envName, rules);
    return env.maxScore !== undefined ? env.maxScore : rules.environments.development.maxScore;
}

export function evaluateCommand(command, options = {}) {
    const rules = options.rules || loadSafetyRules(options.configPath);
    const envName = options.environment || process.env.NEBULA_ENV || rules.defaultEnvironment;
    const env = getEnvironment(envName, rules);

    const violations = [];
    for (const pattern of env.blockedPatterns || []) {
        if (pattern.test(command)) {
            violations.push({ rule: 'blocked-pattern', pattern: pattern.source, env: envName });
        }
    }

    const threshold = envScoreThreshold(envName, rules);
    return {
        allowed: violations.length === 0,
        environment: envName,
        violations,
        threshold,
    };
}

export const createSafetyRules = (pathOverride) => loadSafetyRules(pathOverride);

export default loadSafetyRules;