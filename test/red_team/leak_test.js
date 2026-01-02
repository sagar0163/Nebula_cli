import { AIService } from '../../src/services/ai.service.js';
import { executeSystemCommand } from '../../src/utils/executioner.js';

console.log('🔴 PHASE 2: SECRET LEAKAGE (Scrubber Bypass Test)');

// Mock Env with Secret
process.env.TYK_SECRET_12345 = 'SUPER_SENSITIVE_DATA_XYZ';

// Test 1: Executioner Output Scrubbing (Should Pass)
console.log('\nTest 1: Executioner Output Scrubbing');
try {
    const out = await executeSystemCommand('echo $TYK_SECRET_12345', { cwd: process.cwd() });
    if (out.includes('SUPER_SENSITIVE_DATA_XYZ')) {
        console.log('❌ VULNERABLE: Executioner leaked raw secret directly from env variable!');
    } else if (out.includes('***TYK_SECRET_12345***')) {
        console.log('✅ SECURE: Executioner correctly masked the secret.');
    } else {
        console.log('❓ UNKNOWN: Output was:', out);
    }
} catch (e) {
    console.log('Error running executioner test:', e.message);
}

// Test 2: AI Suggestion Leakage (Simulated)
console.log('\nTest 2: AI Suggestion output (Simulation)');
// Logic: If AI suggests a fix that contains the secret literal (e.g. hardcoded in a script),
// AND Nebula prints it to confirm with the user, does it get masked?
// We check executioner.js maskSecrets function again, but manually apply it to a string 
// that mimics an AI response to see if it catches it.

// Note: Nebula's `session.js` prints `diagnosis.response` directly. 
// It does NOT call `maskSecrets` on the AI text blocks before printing "Suggested Fix".
// Only `executeSystemCommand` output is masked.
// So if AI says "Run this: curl -H 'Auth: SUPER_SENSITIVE_DATA_XYZ'", it leaks.

const aiHallucinatedSecret = "curl -X POST https://api.tyk.io -H 'Authorization: SUPER_SENSITIVE_DATA_XYZ'";
// We manually check if `maskSecrets` handles this string, to see if the UTILITY exists to fix it,
// even if session.js misses it.

// But wait, `maskSecrets` only masks secrets that are IN `process.env`.
// If AI hallucinates a NEW secret that isn't in env, it can't mask it obviously.
// But we are testing if valid secrets (in env) are masked if AI echos them.

import { executioner } from '../../src/utils/executioner.js';
// We can't import internal maskSecrets easily as it's not exported. 
// We will rely on our analysis of session.js code which confirmed NO masking on AI text.

console.log('...Simulating AI response containing known env secret...');
console.log('Mock AI Response:', aiHallucinatedSecret);
console.log('Analysis of session.js confirms: AI text is NOT passed through maskSecrets.');
console.log('❌ VULNERABLE: AI hallucinations of valid secrets are printed in cleartext.');

