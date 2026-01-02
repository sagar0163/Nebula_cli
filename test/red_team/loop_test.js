import { ContextScrubber } from '../../src/utils/context-scrubber.js';

console.log('🔴 PHASE 4: HEALING LOOP (Recursion Trap Test)');

// Simulate a history of repeated failures and fixes
const history = [
    { command: 'npm start' },
    { command: 'nebula fix' }, // 1
    { command: 'npm start' },
    { command: 'nebula fix' }, // 2
    { command: 'ls' },
    { command: 'nebula fix' }, // 3 - Trigger?
];

console.log('History:', history.map(h => h.command));

const isLoop = ContextScrubber.detectLoop(history);

if (isLoop) {
    console.log('✅ PASS: Loop detected correctly.');
} else {
    console.log('❌ FAIL: Loop NOT detected. Logic is too lenient.');
}
