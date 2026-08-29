import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { runSetup } from '../../src/commands/setup.js';

vi.mock('inquirer');

describe('Setup Wizard', () => {
    const rootDir = path.join(__dirname, '../../');
    const envPath = path.join(rootDir, '.env');
    let originalEnvContent = '';

    beforeEach(() => {
        if (fs.existsSync(envPath)) {
            originalEnvContent = fs.readFileSync(envPath, 'utf8');
        }
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalEnvContent) {
            fs.writeFileSync(envPath, originalEnvContent);
        } else if (fs.existsSync(envPath)) {
            fs.unlinkSync(envPath);
        }
    });

    it('should configure Gemini API Key and Model ID', async () => {
        inquirer.prompt
            .mockResolvedValueOnce({ provider: 'gemini' })
            .mockResolvedValueOnce({ apiKey: 'test-gemini-key', model: 'gemini-2.0-flash-exp' });

        await runSetup();

        expect(fs.existsSync(envPath)).toBe(true);
        const envContent = fs.readFileSync(envPath, 'utf8');
        expect(envContent).toContain('GEMINI_API_KEY=test-gemini-key');
        expect(envContent).toContain('GEMINI_MODEL=gemini-2.0-flash-exp');
    });

    it('should configure Groq API Key and Model ID', async () => {
        inquirer.prompt
            .mockResolvedValueOnce({ provider: 'groq' })
            .mockResolvedValueOnce({ apiKey: 'gsk_test-groq-key', model: 'llama-3.3-70b-specdec' });

        await runSetup();

        expect(fs.existsSync(envPath)).toBe(true);
        const envContent = fs.readFileSync(envPath, 'utf8');
        expect(envContent).toContain('GROQ_API_KEY=gsk_test-groq-key');
        expect(envContent).toContain('GROQ_MODEL=llama-3.3-70b-specdec');
    });
});
