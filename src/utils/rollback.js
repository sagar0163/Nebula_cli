import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

function resolveSnapshotDir() {
    return process.env.NEBULA_SNAPSHOT_DIR || path.join(os.homedir(), '.nebula', 'snapshots');
}

function getSnapshotPath(snapshotId) {
    return path.join(resolveSnapshotDir(), snapshotId);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function isBuiltinFS() {
    if (typeof fs.cpSync === 'function' && typeof fs.cpSync === 'function') return true;
    return typeof fs.cpSync === 'function';
}

/**
 * Creates a snapshot of one or more files for later rollback.
 * @param {string[]} filePaths - Absolute paths to snapshot.
 * @param {object} [options]
 * @param {string} [options.reason] - Why this snapshot was created.
 * @param {string} [options.command] - The command that triggered this snapshot.
 * @returns {string} - Snapshot ID (directory name).
 */
export function createSnapshot(filePaths, options = {}) {
    const snapshotId = crypto.randomUUID();
    const snapshotDir = getSnapshotPath(snapshotId);
    ensureDir(snapshotDir);

    const manifest = {
        id: snapshotId,
        timestamp: new Date().toISOString(),
        reason: options.reason || 'manual',
        command: options.command || '',
        files: [],
    };

    for (const filePath of filePaths) {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) continue;
        if (!fs.statSync(absolutePath).isFile()) continue;

        const rel = snapshotRelativePath(absolutePath);
        const dest = path.join(snapshotDir, rel);
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        fs.copyFileSync(absolutePath, dest);
        manifest.files.push({
            originalPath: absolutePath,
            relativePath: rel,
            size: fs.statSync(absolutePath).size,
            checksum: fileChecksum(absolutePath),
        });
    }

    fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return snapshotId;
}

function snapshotRelativePath(absolutePath) {
    let rel = path.relative(process.cwd(), absolutePath);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return rel;
    }
    const sanitized = absolutePath.replace(/^\/+/, '').replace(/^[A-Za-z]:/, '');
    return path.join('ext', sanitized.split(path.sep).join('__'));
}

/**
 * Restores a snapshot by copying all files back to their original locations.
 * @param {string} snapshotId - The snapshot to restore.
 * @returns {{ restored: string[], missing: string[] }}
 */
export function restoreSnapshot(snapshotId) {
    const snapshotDir = getSnapshotPath(snapshotId);
    const manifestFile = path.join(snapshotDir, 'manifest.json');
    if (!fs.existsSync(manifestFile)) throw new Error(`Snapshot not found: ${snapshotId}`);

    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const restored = [];
    const missing = [];

    for (const file of manifest.files) {
        const snapshotFile = path.join(snapshotDir, file.relativePath);
        if (!fs.existsSync(snapshotFile)) {
            missing.push(file.originalPath);
            continue;
        }
        const destDir = path.dirname(file.originalPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(snapshotFile, file.originalPath);
        restored.push(file.originalPath);
    }

    return { restored, missing };
}

/**
 * Lists all available snapshots (newest first).
 * @returns {Array<object>} - Snapshot manifest summaries.
 */
export function listSnapshots() {
    const snapshotDir = resolveSnapshotDir();
    if (!fs.existsSync(snapshotDir)) return [];
    const dirs = fs.readdirSync(snapshotDir).filter((d) => {
        const p = path.join(snapshotDir, d, 'manifest.json');
        return fs.existsSync(p) && fs.statSync(path.join(snapshotDir, d)).isDirectory();
    });
    return dirs.map((d) => {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, d, 'manifest.json'), 'utf8'));
            return { id: manifest.id, timestamp: manifest.timestamp, reason: manifest.reason, command: manifest.command, fileCount: manifest.files.length };
        } catch (_e) {
            return null;
        }
    }).filter(Boolean).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Removes a snapshot from disk.
 * @param {string} snapshotId - The snapshot to remove.
 * @returns {boolean}
 */
export function deleteSnapshot(snapshotId) {
    const snapshotDir = getSnapshotPath(snapshotId);
    if (!fs.existsSync(snapshotDir)) return false;
    fs.rmSync(snapshotDir, { recursive: true, force: true });
    return true;
}

function fileChecksum(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Convenience: snapshot + execute + optional auto-rollback.
 */
export function withRollback(filePaths, command, fn) {
    const snapshotId = createSnapshot(filePaths, { reason: 'pre-command', command });
    return fn().then((result) => ({ snapshotId, result, rolledBack: false })).catch((error) => {
        try {
            const r = restoreSnapshot(snapshotId);
            return { snapshotId, result: null, rolledBack: true, restored: r.restored, error };
        } catch (_rollbackErr) {
            return { snapshotId, result: null, rolledBack: false, error };
        }
    });
}

export const RollbackManager = {
    create: createSnapshot,
    restore: restoreSnapshot,
    list: listSnapshots,
    remove: deleteSnapshot,
    withRollback,
};

export default RollbackManager;