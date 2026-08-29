import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');
const envPath = join(rootDir, '.env');

/**
 * Fetch available local Ollama models.
 * Returns an array of model names or an empty array if Ollama is not running.
 */
async function getOllamaModels() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            return data.models.map(m => m.name);
        }
    } catch (e) {
        // Ollama not running or query failed
    }
    return [];
}

/**
 * Run the interactive configuration setup wizard.
 */
export async function runSetup() {
    console.log(chalk.cyan.bold('\n🌌 Nebula-CLI Configuration Setup Wizard'));
    console.log(chalk.gray('Configure your AI providers, API keys, and model preferences.\n'));

    // Step 1: Select AI Provider
    const { provider } = await inquirer.prompt([{
        type: 'list',
        name: 'provider',
        message: 'Select your preferred default AI Provider:',
        choices: [
            { name: 'Gemini (Google Cloud)', value: 'gemini' },
            { name: 'Groq (Cloud Failover)', value: 'groq' },
            { name: 'Ollama (Local/Private LLM)', value: 'ollama' }
        ]
    }]);

    const config = {};

    // Step 2: Prompt for details based on selected provider
    if (provider === 'gemini') {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'apiKey',
                message: 'Enter your Gemini API Key:',
                validate: (input) => input.trim().length > 0 ? true : 'API key cannot be empty.'
            },
            {
                type: 'input',
                name: 'model',
                message: 'Enter Gemini Model ID:',
                default: 'gemini-2.0-flash-exp'
            }
        ]);
        config.GEMINI_API_KEY = answers.apiKey.trim();
        config.GEMINI_MODEL = answers.model.trim();
    } else if (provider === 'groq') {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'apiKey',
                message: 'Enter your Groq API Key (starts with gsk_):',
                validate: (input) => input.trim().startsWith('gsk_') ? true : 'Invalid Groq API Key format. Must start with gsk_.'
            },
            {
                type: 'input',
                name: 'model',
                message: 'Enter Groq Model ID:',
                default: 'llama-3.3-70b-specdec'
            }
        ]);
        config.GROQ_API_KEY = answers.apiKey.trim();
        config.GROQ_MODEL = answers.model.trim();
    } else if (provider === 'ollama') {
        console.log(chalk.gray('Checking for local Ollama service...'));
        const models = await getOllamaModels();
        
        let ollamaModel;
        if (models.length > 0) {
            console.log(chalk.green('✔ Connected to local Ollama.'));
            const answers = await inquirer.prompt([{
                type: 'list',
                name: 'model',
                message: 'Select installed Ollama model to use:',
                choices: models
            }]);
            ollamaModel = answers.model;
        } else {
            console.log(chalk.yellow('⚠ Ollama service not running on http://localhost:11434.'));
            const answers = await inquirer.prompt([{
                type: 'input',
                name: 'model',
                message: 'Enter default local model name to configure:',
                default: 'llama3.2'
            }]);
            ollamaModel = answers.model.trim();
        }
        config.OLLAMA_MODEL = ollamaModel;
    }

    // Step 3: Read, update, and write the .env file
    try {
        let envContent = '';
        const currentEnv = {};

        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            // Parse existing env variables
            envContent.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length === 2) {
                    currentEnv[parts[0].trim()] = parts[1].trim();
                }
            });
        }

        // Merge new configs
        const mergedEnv = { ...currentEnv, ...config };

        // Reconstruct env content
        const newEnvLines = [];
        // Preserving comments or file structure isn't strictly required, but let's list them cleanly
        Object.keys(mergedEnv).forEach(key => {
            newEnvLines.push(`${key}=${mergedEnv[key]}`);
        });

        fs.writeFileSync(envPath, newEnvLines.join('\n') + '\n');
        
        console.log(chalk.green.bold('\n✔ Configuration saved successfully!'));
        console.log(chalk.gray(`Updated configuration in: ${envPath}`));
    } catch (e) {
        console.log(chalk.red(`\n❌ Failed to save configuration: ${e.message}`));
    }
}
