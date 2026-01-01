import fs from 'fs';
import path from 'path';

export class CommandPredictor {
    static async predictNextCommand(cwd = process.cwd()) {
        const fingerprint = this.deepScan(cwd);

        // Tyk Multi-Path Detection
        const tykMatch = this.detectTyk(fingerprint);
        if (tykMatch.confidence > 0.8) {
            return {
                type: 'TYK_HELM',
                command: tykMatch.command,
                confidence: tykMatch.confidence,
                rationale: tykMatch.rationale,
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
                            // contentPreview: this.previewContent(fullPath) // Optimization: read on demand or strictly for key files
                        });

                        // Specialized detection - read content only for key files
                        if (entry.name === 'Chart.yaml') {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            fingerprint.chartYamls.push({
                                path: relPath,
                                content: content
                            });
                        }

                        if (/\.(yaml|yml)$/.test(entry.name) && !relPath.includes('values')) {
                            fingerprint.k8sFiles.push(relPath);
                        }
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

    static detectTyk(fingerprint) {
        // 1. Check for Tyk in Chart.yaml content
        const tykChart = fingerprint.chartYamls.find(chart =>
            chart.content.includes('tyk') ||
            chart.content.includes('gateway')
        );

        if (tykChart) {
            // We found a Tyk Chart.yaml. 
            // Need to determine the deployment context.
            // E.g. locally in ./charts/ or root.

            const chartDir = path.dirname(tykChart.path); // e.g. "charts" or "." or "tyk-control-plane/charts"

            // Find best values.yaml
            // Strategy: Look for values.yaml in root, or parent of chartDir
            let valuesFile = fingerprint.files.find(f => f.name === 'values.yaml');
            let valuesPathRelToRun = '../values.yaml'; // Default assumption if running from chart dir

            if (valuesFile) {
                // Construct relative path from where we will run the command (chartDir) to the values file
                // If chartDir is ".", valuesFile.path is just "values.yaml" -> -f values.yaml

                // However, common pattern:
                // root/values.yaml
                // root/charts/Chart.yaml
                // Command: cd charts && helm upgrade ... -f ../values.yaml

                // If we are invoking from root (cwd)
                // We want to generate a one-liner that changes dir if necessary.

                // Simplest robust logic: use absolute paths or careful relative paths
                // But user asked for specific "cd charts && ..." style.

                // If chart is in a subdir, we 'cd' into it.
                if (chartDir !== '.') {
                    const valsAbs = path.join(fingerprint.cwd, valuesFile.path);
                    const chartAbs = path.join(fingerprint.cwd, chartDir);
                    const relVals = path.relative(chartAbs, valsAbs);
                    valuesPathRelToRun = relVals;
                } else {
                    valuesPathRelToRun = valuesFile.path;
                }
            }

            const installName = 'tyk';

            if (chartDir !== '.') {
                return {
                    confidence: 0.98,
                    command: `cd ${chartDir} && helm upgrade --install ${installName} . -f ${valuesPathRelToRun} && cd ${path.relative(chartDir, '.') || '..'}`,
                    rationale: `Found Tyk Chart.yaml at ${tykChart.path}`
                };
            } else {
                return {
                    confidence: 0.98,
                    command: `helm upgrade --install ${installName} . -f ${valuesPathRelToRun}`,
                    rationale: `Found Tyk Chart.yaml at root`
                };
            }
        }

        return { confidence: 0 };
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
