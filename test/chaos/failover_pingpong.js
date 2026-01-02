import { AIService } from '../../src/services/ai.service.js';
import { AIRouter } from '../../src/services/ai.router.js';
import chalk from 'chalk';

console.log(chalk.bold.magenta('\n🔥 PHASE 3: PROVIDER "PING-PONG" (FAILOVER LOOP CONTEXT TEST)'));

// Mock AIRouter to force our specific chain
AIRouter.getProviders = () => [
    { name: 'mock_groq', type: 'groq', id: 'groq' },
    { name: 'mock_gemini', type: 'gemini', id: 'gemini' },
    { name: 'mock_hf', type: 'hf_space', id: 'hf', url: 'https://huggingface.co/api-inference.huggingface.co/mock' }
];

// Mock dependencies inside AIService
// Since we can't easily mock private methods or imports without a framework like Jest/Sinon in this raw script,
// we will instantiate the service and "monkey patch" the private #callProvider method 
// (or rather, the method that delegates to it, but #callProvider is private).
// Actually, #callProvider is private. We can monkey patch #executeChain? No, that's private too.
// We can monkey patch the SDKs or the `callProvider` if it was public.
// Wait, `process.env` controls the SDK init.

// Pivot: We will subclass AIService to inspect private method calls? 
// No, JS private fields # are hard boundaries.

// Alternative: We will mock the Network Calls (fetch/Groq/GoogleGenerativeAI).
// This is "Cleaner" anyway.

const service = new AIService();

// Mock Groq
service.groq = {
    chat: {
        completions: {
            create: async () => {
                console.log(chalk.red('   [Groq] Simulating 503 Service Unavailable...'));
                throw new Error('503 Service Unavailable');
            }
        }
    }
};

// Mock Gemini
service.geminiModel = {
    generateContent: async () => {
        console.log(chalk.red('   [Gemini] Simulating 429 Too Many Requests...'));
        throw new Error('429 Too Many Requests');
    }
};

// Mock HF (via global fetch interception)
const originalFetch = global.fetch;
let receivedPrompt = '';

global.fetch = async (url, options) => {
    if (url.includes('api-inference.huggingface.co') || url.includes('hf.space')) {
        console.log(chalk.green('   [HF Space] Received Request.'));
        const body = JSON.parse(options.body);
        // Extract prompt to verify context retention
        receivedPrompt = body.messages ? body.messages[0].content : (body.inputs || '');

        return {
            ok: true,
            json: async () => [{ generated_text: "Final Answer from HF: Analysis Complete." }]
        };
    }
    return originalFetch(url, options); // Pass through others
};

async function runTest() {
    const CRITICAL_CONTEXT = "CRITICAL_CONTEXT_12345";
    const prompt = "Diagnose this system failure.";

    console.log(chalk.yellow(`User Prompt: "${prompt}"`));
    console.log(chalk.yellow(`Hidden Context: "${CRITICAL_CONTEXT}"`));
    console.log(chalk.gray('--- Starting Failover Chain ---'));

    const response = await service.getFix(prompt, CRITICAL_CONTEXT);

    console.log(chalk.gray('--- Chain Complete ---'));
    console.log(`Response Source: ${chalk.bold(response.source)}`);
    console.log(`Response Text: "${response.response}"`);

    // Verification
    if (response.source !== 'mock_hf' && response.source !== 'hf') {
        // ID might come from AIRouter mock or fallback logic
        // The mock providers in AIRouter above didn't have ID 'hf', but 'hf' type might default?
        // Actually `AIProvider` objects usually have names. The `executeChain` returns `provider.id || provider.name`.
        // Our mock AIRouter returned `{ id: 'hf' ... }`
    }

    if (receivedPrompt.includes(CRITICAL_CONTEXT)) {
        console.log(chalk.green.bold('✅ PASS: Context retained across 3-hop failover.'));
    } else {
        console.log(chalk.red.bold('❌ FAIL: Context LOST during failover!'));
        console.log('Received at Endpoint:', receivedPrompt);
        process.exit(1);
    }
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
