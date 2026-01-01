import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { ProjectID } from './project-id.js';

export class ProjectFingerprint {
    /**
     * Generates a structural fingerprint of the directory.
     * @param {string} cwd 
     * @param {number} maxDepth 
     */
    static async generate(cwd = process.cwd(), maxDepth = 3) {
        const structure = this.scanDir(cwd, maxDepth);
        const manifests = this.readManifests(cwd);
        const uid = await ProjectID.getOrCreateUID(cwd);

        const fingerprint = {
            uid,
            structure,
            manifests,
            fileCounts: this.countFileTypes(structure),
            depth: this.maxDepth(structure)
        };

        // Create a deterministic hash of the structure
        fingerprint.hash = crypto.createHash('sha256')
            .update(JSON.stringify(fingerprint.structure))
            .digest('hex');

        return fingerprint;
    }

    static scanDir(dir, maxDepth, currentDepth = 0) {
        if (currentDepth > maxDepth) return null;

        const result = {};
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === '.git' || entry.name === 'node_modules') continue;

                if (entry.isDirectory()) {
                    result[entry.name] = this.scanDir(path.join(dir, entry.name), maxDepth, currentDepth + 1);
                } else {
                    result[entry.name] = 'file';
                }
            }
        } catch {
            return null; // Ignore permission errors
        }
        return result;
    }

    static readManifests(dir) {
        const manifests = {};
        const filesToRead = ['package.json', 'Chart.yaml', 'docker-compose.yml', 'go.mod', 'Cargo.toml', 'requirements.txt'];

        try {
            // Read shallowly (root only/scanner depth) for key files
            // We can use a recursive finder if needed, but for fingerprint, root-ish is good.
            // Let's rely on the structure scan to declare existence, and specific readers for content.

            // Helper to find specific file content in the scanned structure could be complex.
            // Let's just check root for now as primary indicators, and specific subdirs if known (like 'charts' for helm).
            // But "Universal" means we shouldn't hardcode 'charts'. The AI will see the structure "charts/mychart/Chart.yaml".

            // Reading content of root manifest files
            for (const f of filesToRead) {
                if (fs.existsSync(path.join(dir, f))) {
                    manifests[f] = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 1000); // Truncate
                }
            }
        } catch { }
        return manifests;
    }

    static countFileTypes(structure) {
        const counts = {};
        const traverse = (node) => {
            if (!node) return;
            for (const key in node) {
                if (node[key] === 'file') {
                    const ext = path.extname(key) || 'no-ext';
                    counts[ext] = (counts[ext] || 0) + 1;
                } else {
                    traverse(node[key]);
                }
            }
        };
        traverse(structure);
        return counts;
    }

    static maxDepth(structure) {
        let max = 0;
        const traverse = (node, depth) => {
            if (!node) return;
            if (depth > max) max = depth;
            for (const key in node) {
                if (node[key] !== 'file') {
                    traverse(node[key], depth + 1);
                }
            }
        };
        traverse(structure, 0);
        return max;
    }
}
