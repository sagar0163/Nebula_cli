import fs from 'fs';
import path from 'path';

export class CommandPredictor {
    static async predictNextCommand(cwd = process.cwd()) {
        const fingerprint = this.deepScan(cwd);

        // Multi-stage matching (most specific first)
        const predictions = [];

        // Stage 1: Exact Tyk match (your project!)
        if (this.isTykProject(fingerprint)) {
            predictions.push({
                type: 'TYK_HELM',
                command: this.tykDeployCommand(fingerprint),
                confidence: 0.98,
                rationale: 'Exact Tyk Helm structure detected',
                fallback: true
            });
        }

        // Stage 2: Generic Helm
        if (this.isHelmProject(fingerprint)) {
            predictions.push({
                type: 'KUBERNETES_HELM',
                command: this.helmDeployCommand(fingerprint),
                confidence: 0.92,
                rationale: 'Helm charts/ directory detected'
            });
        }

        // Stage 3: Kubernetes manifests
        if (fingerprint.k8sFiles.length >= 2) {
            predictions.push({
                type: 'KUBERNETES',
                command: 'kubectl apply -f . --dry-run=client',
                confidence: 0.88,
                rationale: `${fingerprint.k8sFiles.length} K8s manifests found`
            });
        }

        // Stage 4: Node.js
        if (fingerprint.packageJson) {
            predictions.push({
                type: 'NODEJS',
                command: 'npm ci && npm run dev',
                confidence: 0.90,
                rationale: 'Node.js project detected'
            });
        }

        return predictions[0] || {
            command: 'ls -la',
            confidence: 0.5,
            rationale: 'Unknown project type'
        };
    }

    static deepScan(cwd, maxDepth = 4) {
        const fingerprint = {
            cwd,
            files: [],
            dirs: [],
            chartYamls: [],
            k8sFiles: [],
            packageJson: null,
            dockerCompose: null
        };

        const scan = (dir, depth = 0) => {
            if (depth > maxDepth) return;

            try {
                fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.relative(cwd, fullPath);

                    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                        fingerprint.dirs.push(relPath);
                        scan(fullPath, depth + 1);
                    } else if (entry.isFile()) {
                        fingerprint.files.push({
                            name: entry.name,
                            path: relPath,
                            contentPreview: this.previewContent(fullPath)
                        });

                        // Specialized detection
                        if (entry.name === 'Chart.yaml') {
                            fingerprint.chartYamls.push({
                                path: relPath,
                                content: fs.readFileSync(fullPath, 'utf8')
                            });
                        }
                        if (/\.(yaml|yml)$/.test(entry.name) && !relPath.includes('values')) {
                            fingerprint.k8sFiles.push(relPath);
                        }
                    }
                });
            } catch { }
        };

        scan(cwd);

        // Post-process
        fingerprint.packageJson = this.readJson(cwd, 'package.json');
        fingerprint.dockerCompose = this.readDockerCompose(cwd);

        return fingerprint;
    }

    static isTykProject(fingerprint) {
        return fingerprint.chartYamls.some(chart =>
            chart.content.includes('tyk') ||
            chart.content.includes('gateway') ||
            chart.content.includes('redis')
        ) || fingerprint.files.some(f => f.name.includes('tyk'));
    }

    static isHelmProject(fingerprint) {
        return fingerprint.dirs.includes('charts') ||
            fingerprint.chartYamls.length > 0;
    }

    static tykDeployCommand(fingerprint) {
        // Smart path detection
        const chartDir = fingerprint.dirs.find(d => d.includes('charts')) || '.';
        const valuesFile = fingerprint.files.find(f => f.name === 'values.yaml' ||
            f.name === 'values.yml');

        return `cd ${chartDir} && helm upgrade --install tyk . -f ${valuesFile ? path.relative(chartDir, valuesFile.path) : '../values.yaml'} && cd ..`;
    }

    static helmDeployCommand(fingerprint) {
        return fingerprint.dirs.includes('charts')
            ? 'cd charts && helm upgrade --install . -f ../values.yaml && cd ..'
            : 'helm template . | kubectl apply -f -';
    }

    static previewContent(filePath, maxBytes = 200) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return content.slice(0, maxBytes) + (content.length > maxBytes ? '...' : '');
        } catch {
            return '';
        }
    }

    static readJson(dir, filename) {
        try {
            return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
        } catch {
            return null;
        }
    }

    static readDockerCompose(dir) {
        const paths = ['docker-compose.yml', 'docker-compose.yaml'];
        for (const p of paths) {
            try {
                return fs.readFileSync(path.join(dir, p), 'utf8');
            } catch { }
        }
        return null;
    }
}
