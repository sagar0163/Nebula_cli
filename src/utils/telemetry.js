import fs from 'fs';
import path from 'path';

const TOKEN_FILE = '.nebula_tokens.json';

// Simple in-memory set to track prompt context prefixes for this session
const seenContexts = new Set();

export class Telemetry {
    /**
     * Log an AI provider call and update token efficiency statistics.
     * @param {string} prompt - The prompt sent to the LLM.
     * @param {string} response - The response received.
     * @param {object} provider - The provider configuration object.
     */
    static logCall(prompt, response, provider) {
        try {
            // Determine if this is a prompt cache hit
            // We hash/identify the static context prefix (first 150 chars) of the prompt
            const contextPrefix = prompt.slice(0, 150).trim();
            const isCacheHit = seenContexts.has(contextPrefix);
            
            // Mark this context prefix as seen
            if (contextPrefix.length > 50) {
                seenContexts.add(contextPrefix);
            }

            let data = { total: 0, calls: 0, cacheHits: 0, cacheHitRate: "0.0%", savings: "$0.00" };
            if (fs.existsSync(TOKEN_FILE)) {
                try {
                    data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
                } catch (e) {
                    // Reset on error
                }
            }

            // Estimate tokens (roughly 4 characters per token)
            const promptTokens = Math.ceil(prompt.length / 4);
            const responseTokens = Math.ceil(response.length / 4);
            const callTokens = promptTokens + responseTokens;

            data.total = (data.total || 0) + callTokens;
            data.calls = (data.calls || 0) + 1;

            if (isCacheHit) {
                data.cacheHits = (data.cacheHits || 0) + 1;
                // Cache hit saves input tokens! Assume 80% of input tokens are cached.
                const savedTokens = Math.ceil(promptTokens * 0.8);
                // Assume average price of $0.15 per million tokens for cached input
                const savedUSD = (savedTokens / 1000000) * 0.15;
                
                const currentSavings = parseFloat(data.savings ? data.savings.replace('$', '') : '0');
                data.savings = `$${(currentSavings + savedUSD).toFixed(5)}`;
            }

            data.cacheHitRate = `${((data.cacheHits / data.calls) * 100).toFixed(1)}%`;

            fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
        } catch (err) {
            // Fail silently to avoid breaking the CLI on write errors
        }
    }
}
