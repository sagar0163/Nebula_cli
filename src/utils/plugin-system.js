// Plugin System for Nebula-CLI
// Allows extending Nebula with custom commands

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Plugin interface:
 * {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   commands: {
 *     mycommand: {
 *       description: 'Does something cool',
 *       execute: async (args, options) => { ... }
 *     }
 *   },
 *   hooks: {
 *     'before-execute': async (cmd) => { ... },
 *     'after-execute': async (cmd, result) => { ... }
 *   }
 * }
 */

const plugins = new Map();

/**
 * Load all plugins from the plugins directory
 */
export async function loadPlugins() {
    const pluginsDir = path.join(process.cwd(), '.nebula-plugins');
    const globalPluginsDir = path.join(__dirname, '../../plugins');
    
    const dirs = [pluginsDir, globalPluginsDir].filter(d => fs.existsSync(d));
    
    for (const dir of dirs) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        
        for (const file of files) {
            try {
                const pluginPath = path.join(dir, file);
                const plugin = await import(pluginPath);
                const pluginModule = plugin.default || plugin;
                
                if (pluginModule.name) {
                    plugins.set(pluginModule.name, pluginModule);
                    console.log(chalk.gray(`  ⚡ Loaded plugin: ${pluginModule.name}`));
                }
            } catch (error) {
                console.warn(chalk.yellow(`  ⚠️  Failed to load plugin ${file}:`), error.message);
            }
        }
    }
    
    return plugins;
}

/**
 * Get all loaded plugins
 */
export function getPlugins() {
    return plugins;
}

/**
 * Get a specific plugin by name
 */
export function getPlugin(name) {
    return plugins.get(name);
}

/**
 * Execute a plugin command
 */
export async function executePluginCommand(commandName, args = [], options = {}) {
    for (const [name, plugin] of plugins) {
        if (plugin.commands && plugin.commands[commandName]) {
            // Run before hook
            if (plugin.hooks && plugin.hooks['before-execute']) {
                await plugin.hooks['before-execute']({ command: commandName, args, options });
            }
            
            const result = await plugin.commands[commandName].execute(args, options);
            
            // Run after hook
            if (plugin.hooks && plugin.hooks['after-execute']) {
                await plugin.hooks['after-execute']({ command: commandName, args, options }, result);
            }
            
            return result;
        }
    }
    
    return null;
}

/**
 * List all available plugin commands
 */
export function listPluginCommands() {
    const commands = [];
    
    for (const [name, plugin] of plugins) {
        if (plugin.commands) {
            for (const [cmd, details] of Object.entries(plugin.commands)) {
                commands.push({
                    plugin: name,
                    command: cmd,
                    description: details.description || 'No description'
                });
            }
        }
    }
    
    return commands;
}

export default {
    loadPlugins,
    getPlugins,
    getPlugin,
    executePluginCommand,
    listPluginCommands
};
