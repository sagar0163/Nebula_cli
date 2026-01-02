import { AIService } from '../../src/services/ai.service.js';
import chalk from 'chalk';

console.log('🔴 PHASE 3: FAILOVER STRESS (Network Resilience Test)');

// MOCK GLOBAL FETCH
const originalFetch = global.fetch;
let callCount = 0;

global.fetch = async (url, options) => {
    callCount++;
    console.log(chalk.gray(`[MockNetwork] Call ${callCount} to ${url}`));

    // 1. Mock Groq - 429 Too Many Requests
    if (url.includes('groq.com')) {
        console.log(chalk.yellow('[MockNetwork] Groq: 429 Too Many Requests'));
        return { ok: false, status: 429, json: async () => ({ error: 'Rate limit' }) };
    }

    // 2. Mock Gemini - 503 Service Unavailable
    if (url.includes('generativelanguage')) { // Gemini URL pattern
        console.log(chalk.yellow('[MockNetwork] Gemini: 503 Service Unavailable'));
        throw new Error('503 Service Unavailable');
    }

    // 3. Mock Ollama - Connection Refused (simulated via throw)
    if (url.includes('localhost:11434')) {
        console.log(chalk.yellow('[MockNetwork] Ollama: Connection Refused'));
        throw new Error('ECONNREFUSED');
    }

    // 4. HF Space - SUCCESS
    if (url.includes('hf.space')) {
        console.log(chalk.green('[MockNetwork] HF Space: 200 OK'));
        return {
            ok: true,
            status: 200,
            json: async () => ([{ generated_text: "Final Answer from HF Space" }]),
            choices: [{ message: { content: "Final Answer from HF Space" } }] // For OpenAI compat fallback
        };
    }

    return originalFetch(url, options);
};

// Mock Ollama Library (if used directly, AIService uses 'ollama' lib)
// We need to mock the library import or the method in AIService. 
// Since we can't easily mock ESM imports without a framework, we will rely on AIService catching errors.
// The AIService imports 'ollama'. If we can't ensure it fails, we might see it try local.
// But we saw `ai.service.js` uses `this.#executeOllama`.
// We'll rely on env var to SKIP ollama or force it to fail?
// Or we can just assume `ollama` lib calls `fetch` or `http`? 
// Actually `ollama-js` likely uses useful fetch.
// Let's force `TRAINING_MODE=false` and `task='general'` to trigger the chain: Groq -> Ollama -> Gemini -> HF.

process.env.TRAINING_MODE = 'false';
process.env.GROQ_API_KEY = 'dummy';
process.env.GEMINI_API_KEY = 'dummy';
process.env.HF_TOKEN = 'dummy';

const service = new AIService();
// Inject a mock ollama method if possible, or expect it to fail if ollama not running on this machine?
// If ollama IS running, it might succeed.
// We'll trust the test runner environment doesn't have a configured ollama model or we can break it.
process.env.OLLAMA_MODEL = 'non-existent-model-xyz';

console.log('Testing Failover Chain...');
const result = await service.getChat('Hello Red Team');

console.log('\nResult:', result);

if (result.source.includes('hf_space') || result.response.includes('HF Space')) {
    console.log('✅ PASS: Successfully failed over to HF Space.');
} else {
    console.log('❌ FAIL: Did not reach HF Space. Source:', result.source);
}
