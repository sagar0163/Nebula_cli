import { isSafeCommand } from '../../src/utils/safe-guard.js';
import assert from 'assert';

console.log('🔴 PHASE 1: BYPASS THE FORTRESS (Safety Guard Stress Test)');

const attacks = [
    // 1. Direct Attack (Should be blocked)
    { cmd: 'rm -rf /', expected: false, desc: 'Direct rm -rf' },

    // 2. Base64 Obfuscation (Likely Bypass)
    { cmd: 'echo cm0gLXJmIC8= | base64 -d | sh', expected: false, desc: 'Base64 Obfuscation' },

    // 3. Python Wrapper (Likely Bypass)
    { cmd: 'python3 -c "import os; os.system(\'rm -rf /\')"', expected: false, desc: 'Python Wrapper' },

    // 4. Variable Expansion
    { cmd: 'CMD=rm; $CMD -rf /', expected: false, desc: 'Variable Expansion' },

    // 5. Hex Encoding
    { cmd: '$(printf "\\x72\\x6d\\x20\\x2d\\x72\\x66\\x20\\x2f")', expected: false, desc: 'Hex Encoding' },
];

let vulnerabilities = [];

attacks.forEach(attack => {
    const isSafe = isSafeCommand(attack.cmd);
    const result = isSafe ? 'ALLOWED (VULNERABLE)' : 'BLOCKED (SECURE)';
    console.log(`[${attack.desc}] -> ${result}`);

    if (isSafe && attack.expected === false) {
        vulnerabilities.push(attack.desc);
    }
});

if (vulnerabilities.length > 0) {
    console.log('\n⚠️  VULNERABILITIES DETECTED:', vulnerabilities);
    process.exit(1); // Exit with error to signal vulnerabilities found
} else {
    console.log('\n✅ Fortress is Secure');
}
