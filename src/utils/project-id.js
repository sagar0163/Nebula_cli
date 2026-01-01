import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class ProjectID {
    /**
     * Generate immutable ID for project folder
     * Same folder = same ID across sessions
     */
    static generateUID(cwd) {
        const projectName = path.basename(cwd);
        const canonicalPath = path.resolve(cwd);

        const hash = crypto
            .createHash('sha256')
            .update(projectName + canonicalPath)
            .digest('hex')
            .slice(0, 16);

        return `PROJECT_${hash.toUpperCase()}`;
    }

    /**
     * Get or create .nebula-project-id marker file
     */
    static async getOrCreateUID(cwd) {
        const uidFile = path.join(cwd, '.nebula-project-id');

        if (fs.existsSync(uidFile)) {
            return fs.readFileSync(uidFile, 'utf8').trim();
        }

        const uid = this.generateUID(cwd);
        try {
            fs.writeFileSync(uidFile, uid);
            console.log(`🆕 Created project ID: [${uid}] for ${path.basename(cwd)}`);
        } catch (e) {
            // If write fails (e.g. read-only), just return the calculated ID but warn
            // console.warn('Could not persist project ID:', e.message);
        }
        return uid;
    }
}
