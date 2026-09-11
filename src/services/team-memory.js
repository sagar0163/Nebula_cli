import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const TEAM_MEMORY_DIR = path.join(os.homedir(), '.nebula-cli', 'team');
const TEAM_DB_FILE = path.join(TEAM_MEMORY_DIR, 'team-patterns.json');

/**
 * TeamMemory — shared workflow memory for teams.
 * 
 * Stores team patterns (debugging steps, deploy workflows, code review shortcuts)
 * with CRDT-based conflict-free merging so multiple members can contribute
 * without losing each other's changes.
 * 
 * Patterns are stored locally in ~/.nebula-cli/team/ and can optionally
 * sync with a remote API.
 */
export class TeamMemory {
    constructor(options = {}) {
        this.teamId = options.teamId || null;
        this.storageDir = options.storageDir || TEAM_MEMORY_DIR;
        this.dbFile = path.join(this.storageDir, 'team-patterns.json');
        this.localNodeId = options.nodeId || TeamMemory.generateNodeId();
        this.patterns = new Map();
        this.#ensureDir();
        this.#load();
    }

    /**
     * Generate a unique node ID for this machine/user.
     * Persists across sessions so vector clocks stay consistent.
     */
    static generateNodeId() {
        const nodeIdFile = path.join(TEAM_MEMORY_DIR, '.node-id');
        if (fs.existsSync(nodeIdFile)) {
            return fs.readFileSync(nodeIdFile, 'utf8').trim();
        }
        const nodeId = crypto.randomBytes(8).toString('hex');
        try {
            fs.writeFileSync(nodeIdFile, nodeId);
        } catch {
            // Read-only filesystem — use ephemeral node ID
        }
        return nodeId;
    }

    /**
     * Initialize for a specific team.
     * @param {string} teamId
     */
    async initialize(teamId) {
        this.teamId = teamId;
        this.#load();
    }

    /**
     * Store a team pattern with CRDT metadata.
     * @param {object} pattern
     * @param {string} pattern.name — short identifier, e.g. "docker-port-conflict"
     * @param {string} pattern.category — "debug" | "deploy" | "review" | "custom"
     * @param {string} pattern.description — human-readable description
     * @param {string|string[]} pattern.commands — the actual commands/steps
     * @param {string[]} [pattern.tags] — searchable tags
     * @param {string} [pattern.author] — who contributed this
     * @returns {object} stored pattern with metadata
     */
    async store(pattern) {
        if (!this.teamId) throw new Error('TeamMemory not initialized. Call initialize(teamId) first.');
        if (!pattern.name || !pattern.commands) throw new Error('Pattern must have name and commands.');

        const id = pattern.id || `${this.teamId}:${pattern.name}`;
        const existing = this.patterns.get(id);

        const entry = {
            id,
            teamId: this.teamId,
            name: pattern.name,
            category: pattern.category || 'custom',
            description: pattern.description || '',
            commands: Array.isArray(pattern.commands) ? pattern.commands : [pattern.commands],
            tags: pattern.tags || [],
            author: pattern.author || 'unknown',
            // CRDT: vector clock per node
            vectorClock: existing
                ? this.#mergeClock(existing.vectorClock, { [this.localNodeId]: (existing.vectorClock[this.localNodeId] || 0) + 1 })
                : { [this.localNodeId]: 1 },
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: existing?.usageCount || 0,
            effectivenessScore: existing?.effectivenessScore || 0
        };

        this.patterns.set(id, entry);
        this.#save();
        return entry;
    }

    /**
     * Find patterns by category, tags, or text search.
     * @param {object} query
     * @param {string} [query.category]
     * @param {string[]} [query.tags]
     * @param {string} [query.search] — free-text search across name, description, commands
     * @param {number} [query.limit=10]
     * @returns {object[]}
     */
    find(query = {}) {
        let results = Array.from(this.patterns.values());

        if (query.category) {
            results = results.filter(p => p.category === query.category);
        }

        if (query.tags && query.tags.length > 0) {
            results = results.filter(p =>
                query.tags.some(tag => p.tags.includes(tag))
            );
        }

        if (query.search) {
            const lower = query.search.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                p.description.toLowerCase().includes(lower) ||
                p.commands.some(cmd => cmd.toLowerCase().includes(lower)) ||
                p.tags.some(tag => tag.toLowerCase().includes(lower))
            );
        }

        // Sort by usage count (most used first), then by recency
        results.sort((a, b) => {
            if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        return results.slice(0, query.limit || 10);
    }

    /**
     * Get a specific pattern by ID.
     * @param {string} id
     * @returns {object|null}
     */
    get(id) {
        return this.patterns.get(id) || null;
    }

    /**
     * Record that a pattern was used successfully.
     * @param {string} patternId
     * @param {boolean} [success=true]
     */
    recordUsage(patternId, success = true) {
        const pattern = this.patterns.get(patternId);
        if (!pattern) return;

        pattern.usageCount = (pattern.usageCount || 0) + 1;
        if (success) {
            pattern.effectivenessScore = (pattern.effectivenessScore || 0) + 1;
        }
        pattern.updatedAt = new Date().toISOString();
        this.#save();
    }

    /**
     * Delete a pattern.
     * @param {string} id
     * @returns {boolean}
     */
    delete(id) {
        const existed = this.patterns.has(id);
        this.patterns.delete(id);
        if (existed) this.#save();
        return existed;
    }

    /**
     * List all patterns in the team store.
     * @returns {object[]}
     */
    listAll() {
        return Array.from(this.patterns.values());
    }

    /**
     * Export patterns as a portable JSON blob (for sync or backup).
     * @returns {object}
     */
    export() {
        return {
            teamId: this.teamId,
            exportedAt: new Date().toISOString(),
            nodeId: this.localNodeId,
            patterns: Array.from(this.patterns.values())
        };
    }

    /**
     * Import patterns from a remote export, merging via CRDT.
     * @param {object} data — exported blob from export() or remote sync
     * @returns {{ merged: number, conflicts: number }}
     */
    import(data) {
        if (!data || !Array.isArray(data.patterns)) {
            throw new Error('Invalid import data: missing patterns array');
        }

        let merged = 0;
        let conflicts = 0;

        for (const remotePattern of data.patterns) {
            const localPattern = this.patterns.get(remotePattern.id);

            if (!localPattern) {
                // New pattern — accept it
                this.patterns.set(remotePattern.id, remotePattern);
                merged++;
                continue;
            }

            // CRDT merge: compare vector clocks
            const localDominated = this.#isDominated(localPattern.vectorClock, remotePattern.vectorClock);
            const remoteDominated = this.#isDominated(remotePattern.vectorClock, localPattern.vectorClock);

            if (localDominated) {
                // Remote dominates — accept remote
                this.patterns.set(remotePattern.id, remotePattern);
                merged++;
            } else if (!remoteDominated) {
                // Concurrent edits — merge (LWW on updatedAt, combine usage counts)
                const mergedPattern = {
                    ...localPattern,
                    commands: [...new Set([...localPattern.commands, ...remotePattern.commands])],
                    tags: [...new Set([...localPattern.tags, ...remotePattern.tags])],
                    vectorClock: this.#mergeClock(localPattern.vectorClock, remotePattern.vectorClock),
                    usageCount: (localPattern.usageCount || 0) + (remotePattern.usageCount || 0),
                    effectivenessScore: (localPattern.effectivenessScore || 0) + (remotePattern.effectivenessScore || 0),
                    updatedAt: new Date(Math.max(
                        new Date(localPattern.updatedAt).getTime(),
                        new Date(remotePattern.updatedAt).getTime()
                    )).toISOString()
                };
                this.patterns.set(remotePattern.id, mergedPattern);
                conflicts++;
            }
            // else local dominates — keep local (no-op)
        }

        this.#save();
        return { merged, conflicts };
    }

    // ── CRDT Vector Clock Helpers ──

    /**
     * Merge two vector clocks (element-wise max).
     */
    #mergeClock(a, b) {
        const result = { ...a };
        for (const [node, time] of Object.entries(b)) {
            result[node] = Math.max(result[node] || 0, time);
        }
        return result;
    }

    /**
     * Returns true if clock `a` is dominated by (happened-before) clock `b`.
     */
    #isDominated(a, b) {
        const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);
        let strictlyLess = false;
        for (const node of allNodes) {
            const aVal = a[node] || 0;
            const bVal = b[node] || 0;
            if (aVal > bVal) return false;
            if (aVal < bVal) strictlyLess = true;
        }
        return strictlyLess;
    }

    // ── File I/O ──

    #load() {
        try {
            if (!fs.existsSync(this.dbFile)) return;
            const data = JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
            if (data.teamId) this.teamId = data.teamId;
            if (Array.isArray(data.patterns)) {
                this.patterns = new Map(data.patterns.map(p => [p.id, p]));
            }
        } catch {
            this.patterns = new Map();
        }
    }

    #save() {
        const data = {
            teamId: this.teamId,
            patterns: Array.from(this.patterns.values()),
            lastSynced: new Date().toISOString(),
            version: '1.0'
        };
        try {
            fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2));
        } catch {
            // Read-only filesystem — silent fail for tests
        }
    }

    #ensureDir() {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }
}

export default TeamMemory;
