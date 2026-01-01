import fs from 'fs';
import path from 'path';

class ProjectScanner {
    /**
     * Scan directory → Generate project fingerprint
     */
    static analyze(cwd = process.cwd()) {
        const fingerprint = {
            cwd: cwd,
            files: this.#scanFiles(cwd),
            dirs: this.#scanDirs(cwd),
            packageJson: this.#readPackageJson(cwd),
            chartYaml: this.#readChartYaml(cwd),
            k8sFiles: this.#findK8sFiles(cwd),
        };

        return this.#classifyProject(fingerprint);
    }

    static #scanFiles(dir, maxDepth = 2) {
        const files = [];
        const scan = (currentDir, depth) => {
            if (depth > maxDepth) return;

            try {
                fs.readdirSync(currentDir, { withFileTypes: true }).forEach(entry => {
                    const fullPath = path.join(currentDir, entry.name);
                    if (entry.isFile()) {
                        files.push({
                            name: entry.name,
                            path: path.relative(process.cwd(), fullPath),
                            size: fs.statSync(fullPath).size,
                        });
                    } else if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                        scan(fullPath, depth + 1);
                    }
                });
            } catch (e) { }
        };

        scan(dir, 0);
        return files.slice(0, 50); // Top 50 files
    }

    static #scanDirs(dir) {
        try {
            return fs.readdirSync(dir, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith('.'))
                .map(d => d.name);
        } catch {
            return [];
        }
    }

    static #readPackageJson(dir) {
        try {
            return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        } catch {
            return null;
        }
    }

    static #readChartYaml(dir) {
        try {
            return fs.readFileSync(path.join(dir, 'Chart.yaml'), 'utf8');
        } catch {
            return null;
        }
    }

    static #findK8sFiles(dir) {
        const k8sFiles = [];
        const scan = (currentDir, depth = 0) => {
            if (depth > 3) return;

            try {
                fs.readdirSync(currentDir, { withFileTypes: true }).forEach(entry => {
                    const fullPath = path.join(currentDir, entry.name);
                    const isIgnored = /^(package(-lock)?\.json|tsconfig\.json|\.eslintrc.*|.*\.lock)$/.test(entry.name);

                    if (entry.isFile() && /\.(yaml|yml|json)$/.test(entry.name) && !isIgnored) {
                        k8sFiles.push({
                            name: entry.name,
                            path: path.relative(process.cwd(), fullPath),
                        });
                    } else if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                        scan(fullPath, depth + 1);
                    }
                });
            } catch { }
        };
        scan(dir);
        return k8sFiles;
    }

    static #classifyProject(fingerprint) {
        const { dirs, packageJson, chartYaml, k8sFiles } = fingerprint;

        // Tyk/Helm detection
        if (chartYaml && chartYaml.includes('tyk')) {
            return {
                type: 'TYK_HELM',
                confidence: 0.98,
                suggestedCommands: [
                    'helm upgrade --install tyk ./charts/ -f values.yaml',
                    'kubectl get pods -n tyk',
                ],
                fingerprint
            };
        }

        // Generic Kubernetes/Helm
        if (k8sFiles.length >= 3 || dirs.includes('charts')) {
            return {
                type: 'KUBERNETES_HELM',
                confidence: 0.95,
                suggestedCommands: [
                    'kubectl apply -f .',
                    'helm template .',
                ],
                fingerprint
            };
        }

        // Node.js project
        if (packageJson) {
            return {
                type: 'NODEJS',
                confidence: 0.90,
                suggestedCommands: [
                    'npm install',
                    'npm start',
                    'npm run dev'
                ],
                fingerprint
            };
        }

        return { type: 'UNKNOWN', confidence: 0.1, suggestedCommands: [], fingerprint };
    }
}

export default ProjectScanner;
