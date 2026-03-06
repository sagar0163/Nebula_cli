// Config file loader for .nebularc.json / .nebularc.yaml
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supported config file names
const CONFIG_FILES = [
    '.nebularc.json',
    '.nebularc.yaml',
    '.nebularc.yml',
    '.nebularc.js',
    'nebula.config.js'
];

/**
 * Load config from file and merge with environment variables
 */
export function loadConfig(configPath = null) {
    let config = {};

    // 1. If explicit config path provided
    if (configPath) {
        if (fs.existsSync(configPath)) {
            config = parseConfigFile(configPath);
        } else {
            console.warn(`Config file not found: ${configPath}`);
        }
    }

    // 2. Look for config in current directory
    const cwd = process.cwd();
    for (const file of CONFIG_FILES) {
        const filePath = path.join(cwd, file);
        if (fs.existsSync(filePath)) {
            config = { ...config, ...parseConfigFile(filePath) };
            break;
        }
    }

    // 3. Look in home directory
    const homeConfig = path.join(process.env.HOME || '', '.nebularc.json');
    if (fs.existsSync(homeConfig)) {
        config = { ...config, ...parseConfigFile(homeConfig) };
    }

    // 4. . Merge withenv file if exists
    const envPath = path.join(cwd, '.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }

    // 5. Environment variables override config file
    config = applyEnvOverrides(config);

    return config;
}

/**
 * Parse config file based on extension
 */
function parseConfigFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
        switch (ext) {
            case '.json':
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            case '.yaml':
            case '.yml':
                // Simple YAML parser for basic key-value config
                return parseYaml(fs.readFileSync(filePath, 'utf-8'));
            case '.js':
                // ESM module
                return import(filePath).then(mod => mod.default || mod).catch(() => ({}));
            default:
                return {};
        }
    } catch (error) {
        console.warn(`Error parsing config file ${filePath}:`, error.message);
        return {};
    }
}

/**
 * Simple YAML parser for basic key-value pairs
 */
function parseYaml(content) {
    const result = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const match = trimmed.match(/^([^:]+):\s*(.+)$/);
            if (match) {
                result[match[1].trim()] = match[2].trim();
            }
        }
    }
    
    return result;
}

/**
 * Apply environment variable overrides
 */
function applyEnvOverrides(config) {
    const envPrefix = 'NEBULA_';
    
    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith(envPrefix)) {
            const configKey = key.slice(envPrefix).toLowerCase();
            config[configKey] = value;
        }
    }

    // Known environment variables
    if (process.env.GEMINI_API_KEY) config.geminiApiKey = process.env.GEMINI_API_KEY;
    if (process.env.GROQ_API_KEY) config.groqApiKey = process.env.GROQ_API_KEY;
    if (process.env.OLLAMA_MODEL) config.ollamaModel = process.env.OLLAMA_MODEL;
    if (process.env.ANTHROPIC_API_KEY) config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (process.env.OPENAI_API_KEY) config.openaiApiKey = process.env.OPENAI_API_KEY;

    return config;
}

export default { loadConfig };
