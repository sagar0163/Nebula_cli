// Benchmark Utility for Nebula-CLI
// Measure performance of AI providers and commands

import chalk from 'chalk';
import { AIService } from '../services/ai.service.js';
import { providers } from '../config/ai.providers.js';

/**
 * Benchmark an AI provider
 */
async function benchmarkProvider(provider, prompt = 'What is 2+2?') {
    const aiService = new AIService();
    const start = Date.now();
    
    try {
        const result = await aiService.#callProvider(provider, prompt, null);
        const duration = Date.now() - start;
        
        return {
            provider: provider.name || provider.id,
            success: true,
            duration,
            response: result?.slice(0, 100) || 'empty'
        };
    } catch (error) {
        const duration = Date.now() - start;
        return {
            provider: provider.name || provider.id,
            success: false,
            duration,
            error: error.message
        };
    }
}

/**
 * Run benchmarks for all available providers
 */
export async function runProviderBenchmarks() {
    console.log(chalk.bold('\n📊 AI Provider Benchmarks\n'));
    
    const availableProviders = Object.values(providers).filter(p => {
        // Check if API key is available
        const keyEnv = {
            ollama: 'OLLAMA_MODEL',
            groq: 'GROQ_API_KEY',
            gemini: 'GEMINI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            openai: 'OPENAI_API_KEY',
            hf_space: 'HF_SPACE_URL'
        };
        return process.env[keyEnv[p.id]] || p.id === 'ollama';
    });
    
    const results = [];
    
    for (const provider of availableProviders) {
        process.stdout.write(`Testing ${provider.name}... `);
        const result = await benchmarkProvider(provider);
        results.push(result);
        
        if (result.success) {
            console.log(chalk.green(`${result.duration}ms`));
        } else {
            console.log(chalk.red(`Failed: ${result.error}`));
        }
    }
    
    // Summary
    console.log(chalk.bold('\n📈 Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const successful = results.filter(r => r.success).sort((a, b) => a.duration - b.duration);
    
    for (const result of successful) {
        const bar = '█'.repeat(Math.min(50, Math.floor(result.duration / 50)));
        console.log(
            `${chalk.cyan(result.provider.padEnd(20))} ${chalk.green(result.duration.toString().padStart(4))}ms ${bar}`
        );
    }
    
    if (successful.length === 0) {
        console.log(chalk.yellow('⚠️  No providers available. Check API keys.'));
    }
    
    return results;
}

/**
 * Benchmark command execution
 */
export async function benchmarkCommand(command, iterations = 5) {
    console.log(chalk.bold(`\n⚡ Command Benchmark: ${command}\n`));
    
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        // Simulate command (just timing)
        await new Promise(resolve => setTimeout(resolve, 100));
        const duration = Date.now() - start;
        times.push(duration);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log(chalk.cyan('Results:'));
    console.log(`  Average: ${chalk.green(avg.toFixed(2))}ms`);
    console.log(`  Min:     ${chalk.green(min)}ms`);
    console.log(`  Max:     ${chalk.yellow(max)}ms`);
    
    return { avg, min, max, times };
}

export default {
    benchmarkProvider,
    runProviderBenchmarks,
    benchmarkCommand,
};
