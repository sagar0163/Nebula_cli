import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TaxonomySystem {
    constructor() {
        // Init sqlite db
        this.dbDir = path.join(os.homedir(), '.nebula-cli');
        if (!fs.existsSync(this.dbDir)) {
            fs.mkdirSync(this.dbDir, { recursive: true });
        }
        this.dbPath = path.join(this.dbDir, 'taxonomy.db');
        this.db = new Database(this.dbPath);
        this.initDb();
    }

    initDb() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS patterns (
                id TEXT PRIMARY KEY,
                commandRegex TEXT,
                errorRegex TEXT,
                os TEXT,
                shell TEXT,
                fix TEXT,
                confidence REAL DEFAULT 0.5,
                source TEXT DEFAULT 'local',
                lastUpdated INTEGER
            )
        `);
    }

    // Load from JSON file (e.g. community patterns)
    loadCommunityPatterns(jsonPath) {
        if (!fs.existsSync(jsonPath)) return;
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const stmt = this.db.prepare(`
            INSERT INTO patterns (id, commandRegex, errorRegex, os, shell, fix, confidence, source, lastUpdated)
            VALUES (@id, @commandRegex, @errorRegex, @os, @shell, @fix, @confidence, 'community', @lastUpdated)
            ON CONFLICT(id) DO UPDATE SET
                commandRegex = excluded.commandRegex,
                errorRegex = excluded.errorRegex,
                os = excluded.os,
                shell = excluded.shell,
                fix = excluded.fix,
                source = excluded.source,
                lastUpdated = excluded.lastUpdated
        `);
        
        const updateDb = this.db.transaction((patterns) => {
            for (const pat of patterns) {
                stmt.run({
                    id: pat.id,
                    commandRegex: pat.commandRegex,
                    errorRegex: pat.errorRegex,
                    os: JSON.stringify(pat.os || []),
                    shell: JSON.stringify(pat.shell || []),
                    fix: pat.fix,
                    confidence: pat.confidence || 0.5,
                    lastUpdated: Date.now()
                });
            }
        });
        
        updateDb(data);
    }

    match(command, errorMsg) {
        const rows = this.db.prepare('SELECT * FROM patterns ORDER BY confidence DESC').all();
        const currentOs = process.platform;
        const currentShell = process.env.SHELL || 'bash';

        for (const row of rows) {
            // Apply decay based on lastUpdated? "Time decay: Older patterns get lower confidence"
            // Let's calculate effective confidence
            let timeDecay = 1;
            if (row.lastUpdated) {
                const daysOld = (Date.now() - row.lastUpdated) / (1000 * 60 * 60 * 24);
                // Decay by 1% per day, max 50%
                timeDecay = Math.max(0.5, 1 - (daysOld * 0.01));
            }
            const effectiveConfidence = row.confidence * timeDecay;
            
            // Context awareness
            const osList = JSON.parse(row.os || '[]');
            if (osList.length > 0 && !osList.includes(currentOs)) continue;
            
            const shellList = JSON.parse(row.shell || '[]');
            // fuzzy shell check
            if (shellList.length > 0 && !shellList.some(s => currentShell.includes(s))) continue;

            if (row.commandRegex && !new RegExp(row.commandRegex).test(command)) continue;
            
            if (row.errorRegex && !new RegExp(row.errorRegex).test(errorMsg)) continue;
            
            return {
                ...row,
                effectiveConfidence
            };
        }
        return null;
    }

    updateConfidence(id, success) {
        const row = this.db.prepare('SELECT confidence FROM patterns WHERE id = ?').get(id);
        if (!row) return;

        // Bayesian-like update
        let conf = row.confidence;
        if (success) {
            conf = conf + 0.1 * (1 - conf);
        } else {
            conf = conf - 0.2 * conf; // Penalize failure more
        }
        
        this.db.prepare('UPDATE patterns SET confidence = ?, lastUpdated = ? WHERE id = ?')
               .run(conf, Date.now(), id);
    }
    
    searchPatterns(query) {
        // fuzzy search commandRegex, errorRegex, or fix
        const stmt = this.db.prepare(`
            SELECT * FROM patterns 
            WHERE commandRegex LIKE @q 
               OR errorRegex LIKE @q 
               OR fix LIKE @q
            ORDER BY confidence DESC
        `);
        return stmt.all({ q: `%${query}%` });
    }
}
