import { AIRouter } from '../src/services/ai.router.js';
import { providers } from '../src/config/ai.providers.js';
import assert from 'assert';

console.log('🧪 Testing Nebula AI Routing...');

// Test 1: Training Mode (Should always be HF Space)
process.env.TRAINING_MODE = 'true';
const trainProviders = AIRouter.getProviders('shell');
assert.strictEqual(trainProviders.length, 1, 'Training mode should return 1 provider');
assert.strictEqual(trainProviders[0].id, 'hf_space', 'Training mode should be HF Space');
console.log('✅ Training Mode: PASSED');

// Test 2: Normal Mode - Shell (Ollama -> Groq -> HF)
process.env.TRAINING_MODE = 'false';
const shellProviders = AIRouter.getProviders('shell');
assert.strictEqual(shellProviders[0].id, 'ollama', 'Shell first priority should be Ollama');
assert.strictEqual(shellProviders[1].id, 'groq', 'Shell second priority should be Groq');
console.log('✅ Normal Mode (Shell): PASSED');

// Test 3: Normal Mode - Planning (HF Space -> Groq)
const planProviders = AIRouter.getProviders('planning');
assert.strictEqual(planProviders[0].id, 'hf_space', 'Planning first priority should be HF Space');
console.log('✅ Normal Mode (Planning): PASSED');

// Test 4: Normal Mode - General (Groq -> Ollama -> HF)
const generalProviders = AIRouter.getProviders('general');
assert.strictEqual(generalProviders[0].id, 'groq', 'General first priority should be Groq');
assert.strictEqual(generalProviders[2].id, 'gemini', 'General third priority should be Gemini');
console.log('✅ Normal Mode (General): PASSED');

console.log('🎉 All Routing Tests Passed!');
