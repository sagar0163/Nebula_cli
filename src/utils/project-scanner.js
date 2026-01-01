import fs from 'fs';
import path from 'path';

import SessionContext from './session-context.js';

export class CommandPredictor {
    static async predictNextCommand(cwd = process.cwd()) {
        const fingerprint = this.deepScan(cwd);

        // Universal Helm Detection
        const helmMatch = this.detectHelmChart(fingerprint);
        if (helmMatch.confidence > 0.8) {
            return {
                type: 'HELM',
                ...helmMatch,
                fingerprint
            };
        }

        // Layer 2: OpenShift Detection (File + Runtime)
        const isOpenShift = await SessionContext.isOpenShift();
        if (fingerprint.openshiftFile || isOpenShift) {
            return {
                type: 'OPENSHIFT',
                command: 'oc new-app . --name=myapp',
                confidence: fingerprint.openshiftFile ? 0.9 : 0.7,
                rationale: isOpenShift ? 'OpenShift cluster detected' : 'OpenShift config found',
                fingerprint
            };
        }

        // Layer 1: RPM/Spec Detection
        if (fingerprint.rpm) {
            const specFile = fingerprint.files.find(f => f.name.endsWith('.spec'))?.name || '*.spec';
            return {
                type: 'RPM',
                command: `rpmbuild -ba ${specFile}`,
                confidence: 0.95,
                rationale: 'RPM Spec file detected',
                fingerprint
            };
        }

        // Layer 1: Docker
        if (fingerprint.docker) {
            return {
                type: 'DOCKER',
                command: 'docker build -t app .',
                confidence: 0.95,
                rationale: 'Dockerfile detected',
                fingerprint
            };
        }

        // Layer 1: IaC (Terraform/Ansible)
        if (fingerprint.terraform) {
            return {
                type: 'TERRAFORM',
                command: 'terraform apply',
                confidence: 0.95,
                rationale: 'Terraform detected',
                fingerprint
            };
        }
        if (fingerprint.ansible) {
            return {
                type: 'ANSIBLE',
                command: 'ansible-playbook site.yml',
                confidence: 0.85,
                rationale: 'Ansible playbook detected',
                fingerprint
            };
        }

        // Generic fallbacks
        return this.genericPrediction(fingerprint);
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
                const entries = fs.readdirSync(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.relative(cwd, fullPath);

                    if (entry.isDirectory()) {
                        if (entry.name !== 'node_modules' && entry.name !== '.git') {
                            fingerprint.dirs.push(relPath);
                            scan(fullPath, depth + 1);
                        }
                    } else {
                        fingerprint.files.push({
                            name: entry.name,
                            path: relPath,
                        });

                        // Specialized detection
                        if (entry.name === 'Chart.yaml') {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            fingerprint.chartYamls.push({ path: relPath, content: content });
                        }

                        if (/\.(yaml|yml)$/.test(entry.name) && !relPath.includes('values')) {
                            fingerprint.k8sFiles.push(relPath);
                        }

                        // Layer 1 Signatures
                        if (entry.name.endsWith('.spec')) fingerprint.rpm = true;
                        if (entry.name === 'Dockerfile') fingerprint.docker = true;
                        if (entry.name === 'main.tf') fingerprint.terraform = true;
                        if (entry.name === 'playbook.yml' || entry.name === 'site.yml') fingerprint.ansible = true;
                        if (entry.name === 'Route.yaml' || entry.name === 'DeploymentConfig.yaml') fingerprint.openshiftFile = true;
                    }
                }
            } catch (e) {
                // Ignore permission errors etc
            }
        };

        scan(cwd);

        // Post-process
        fingerprint.packageJson = this.readJson(cwd, 'package.json');

        // Universal Path Detection
        const chartEntry = fingerprint.dirs.find(d => d.includes('charts')) || fingerprint.files.find(f => f.path.includes('charts'));
        fingerprint.charts = chartEntry ? [chartEntry.path || chartEntry] : [];

        fingerprint.valuesFiles = fingerprint.files
            .filter(f => f.name.includes('values') && f.name.endsWith('.yaml'))
            .map(f => f.path);

        return fingerprint;
    }

    static detectHelmChart(fingerprint) {  // Renamed: Universal, not Tyk-specific
        const chart = fingerprint.chartYamls[0];  // First Chart.yaml
        if (!chart) return { confidence: 0 };

        // 1. PARSE Chart.yaml dynamically
        const chartName = this.parseChartName(chart.content);  // e.g. "tyk-cp"

        // 2. Find BEST values.yaml (root preferred)
        const rootValues = fingerprint.valuesFiles.find(v => !v.includes('charts'));
        const valuesPath = rootValues || fingerprint.valuesFiles[0] || 'values.yaml';

        // 3. Relative path from cwd (user runs from root)
        // Generic Helm Command:
        // helm dependency update
        // helm upgrade --install <release> <chart> -f <values>
        const helmCmdBase = `helm dependency update && helm upgrade --install ${chartName} ./charts -f ${valuesPath}`;

        return {
            confidence: 0.98,
            command: helmCmdBase,
            rationale: `Dynamic: Chart="${chartName}", Values="${valuesPath}"`,
            chartName
        };
    }

    static parseChartName(chartContent) {
        const nameMatch = chartContent.match(/^name:\s*(.+)$/m);
        return nameMatch ? nameMatch[1].trim().replace(/"/g, '') : 'release';
    }

    static genericPrediction(fingerprint) {
        if (fingerprint.packageJson) {
            return {
                type: 'NODEJS',
                command: 'npm ci && npm run dev',
                confidence: 0.90,
                rationale: 'Node.js project detected',
                fingerprint
            };
        }

        if (fingerprint.k8sFiles.length >= 2) {
            return {
                type: 'KUBERNETES',
                command: 'kubectl apply -f . --dry-run=client',
                confidence: 0.88,
                rationale: `${fingerprint.k8sFiles.length} K8s manifests found`,
                fingerprint
            };
        }

        return {
            command: 'ls -la',
            confidence: 0.1,
            rationale: 'Unknown project structure',
            fingerprint
        };
    }

    static readJson(dir, filename) {
        try {
            return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
        } catch {
            return null;
        }
    }
}
