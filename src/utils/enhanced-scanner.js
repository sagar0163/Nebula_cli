// Project Scanner - Enhanced with more patterns
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common project files and patterns
const PROJECT_PATTERNS = {
  nodejs: {
    files: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    dirs: ['node_modules', '.npm'],
    scripts: ['start', 'dev', 'build', 'test']
  },
  python: {
    files: ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py', 'poetry.lock'],
    dirs: ['venv', '.venv', '__pycache__', '.pytest_cache'],
    scripts: ['run', 'test', 'shell']
  },
  rust: {
    files: ['Cargo.toml', 'Cargo.lock', 'rustfmt.toml'],
    dirs: ['target', 'src'],
    scripts: ['build', 'run', 'test']
  },
  go: {
    files: ['go.mod', 'go.sum', 'Gopkg.toml'],
    dirs: ['vendor', 'cmd', 'internal'],
    scripts: ['build', 'run', 'test']
  },
  java: {
    files: ['pom.xml', 'build.gradle', 'gradle.properties'],
    dirs: ['target', 'build', '.gradle', 'src/main'],
    scripts: ['compile', 'run', 'test']
  },
  docker: {
    files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile.dev'],
    dirs: ['.docker'],
    scripts: ['build', 'up', 'down']
  },
  kubernetes: {
    files: ['kubectl.yaml', 'k8s.yaml', 'helm.yaml'],
    dirs: ['k8s', 'kubernetes', 'helm'],
    scripts: ['apply', 'delete']
  }
};

// Detect project type
export const detectProjectType = (cwd = process.cwd()) => {
  const results = {};
  
  for (const [type, pattern] of Object.entries(PROJECT_PATTERNS)) {
    let score = 0;
    
    // Check files
    for (const file of pattern.files) {
      if (fs.existsSync(path.join(cwd, file))) {
        score += 2;
      }
    }
    
    // Check directories
    for (const dir of pattern.dirs) {
      if (fs.existsSync(path.join(cwd, dir))) {
        score += 1;
      }
    }
    
    if (score > 0) {
      results[type] = score;
    }
  }
  
  // Sort by score
  const sorted = Object.entries(results)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);
  
  return sorted;
};

// Get project info
export const getProjectInfo = (cwd = process.cwd()) => {
  const projectType = detectProjectType(cwd);
  const packageJson = path.join(cwd, 'package.json');
  
  let info = {
    type: projectType[0] || 'unknown',
    types: projectType,
    hasPackageJson: fs.existsSync(packageJson),
    packageJson: null,
    git: fs.existsSync(path.join(cwd, '.git')),
    docker: projectType.includes('docker'),
    kubernetes: projectType.includes('kubernetes')
  };
  
  if (info.hasPackageJson) {
    try {
      info.packageJson = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      info.name = info.packageJson.name;
      info.version = info.packageJson.version;
      info.scripts = info.packageJson.scripts || {};
      info.dependencies = info.packageJson.dependencies || {};
      info.devDependencies = info.packageJson.devDependencies || {};
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return info;
};

// Scan for interesting files
export const scanProjectFiles = (cwd = process.cwd(), options = {}) => {
  const {
    maxDepth = 3,
    includeHidden = false,
    exclude = ['node_modules', '.git', 'dist', 'build', 'coverage', '.cache']
  } = options;
  
  const files = [];
  const dirs = new Set();
  
  const scan = (dir, depth = 0) => {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(cwd, fullPath);
        
        // Skip excluded
        if (exclude.includes(entry.name)) continue;
        
        // Skip hidden files unless enabled
        if (!includeHidden && entry.name.startsWith('.')) continue;
        
        if (entry.isFile()) {
          files.push({
            path: relativePath,
            name: entry.name,
            ext: path.extname(entry.name)
          });
        } else if (entry.isDirectory()) {
          dirs.add(relativePath);
          scan(fullPath, depth + 1);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  };
  
  scan(cwd);
  
  return { files, dirs: Array.from(dirs) };
};

// Find executable scripts
export const findScripts = (cwd = process.cwd()) => {
  const info = getProjectInfo(cwd);
  
  if (!info.packageJson?.scripts) {
    return [];
  }
  
  return Object.entries(info.packageJson.scripts).map(([name, command]) => ({
    name,
    command,
    common: ['start', 'dev', 'build', 'test', 'lint'].includes(name)
  }));
};

// Get environment info
export const getEnvInfo = () => {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DEBUG: !!process.env.DEBUG,
      TEST: !!process.env.TEST
    }
  };
};

export default {
  detectProjectType,
  getProjectInfo,
  scanProjectFiles,
  findScripts,
  getEnvInfo
};
