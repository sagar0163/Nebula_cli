import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Telemetry } from '../../src/utils/telemetry.js';

describe('Telemetry', () => {
    const tokenFile = '.nebula_tokens.json';

    beforeEach(() => {
        // Clean up previous token stats
        if (fs.existsSync(tokenFile)) {
            fs.unlinkSync(tokenFile);
        }
    });

    afterEach(() => {
        // Clean up after test
        if (fs.existsSync(tokenFile)) {
            fs.unlinkSync(tokenFile);
        }
    });

    it('should log a new API call and estimate token usage', () => {
        const prompt = 'hello world'; // ~3 tokens
        const response = 'hi there'; // ~2 tokens
        const provider = { type: 'gemini', model: 'gemini-2.0-flash-exp' };

        Telemetry.logCall(prompt, response, provider);

        expect(fs.existsSync(tokenFile)).toBe(true);

        const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        expect(data.calls).toBe(1);
        expect(data.total).toBe(Math.ceil(prompt.length / 4) + Math.ceil(response.length / 4));
        expect(data.cacheHits).toBe(0);
    });

    it('should track prompt caching hits for repeated static contexts', () => {
        const staticPrefix = 'System Prompt Context '.repeat(10); // long context > 150 chars
        const prompt1 = `${staticPrefix} Query 1`;
        const prompt2 = `${staticPrefix} Query 2`;
        const response = 'ok';
        const provider = { type: 'gemini', model: 'gemini-2.0-flash-exp' };

        Telemetry.logCall(prompt1, response, provider);
        Telemetry.logCall(prompt2, response, provider);

        const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        expect(data.calls).toBe(2);
        expect(data.cacheHits).toBe(1);
        expect(data.cacheHitRate).toBe('50.0%');
        expect(parseFloat(data.savings.replace('$', ''))).toBeGreaterThan(0);
    });
});
