import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadSafetyRules, evaluateCommand, getEnvironment } from '../../src/utils/safety-rules.js';
import { DEFAULT_RULES } from '../../src/utils/safety-rules.js';

const TEST_CONFIG = path.join(os.tmpdir(), 'nebula-safety-test-' + Date.now() + '.json');

describe('safety-rules', () => {
  beforeEach(() => {
    delete process.env.NEBULA_ENV;
  });

  afterEach(() => {
    delete process.env.NEBULA_ENV;
    if (process.env.NEBULA_SAFETY_CONFIG && process.env.NEBULA_SAFETY_CONFIG === TEST_CONFIG) {
      delete process.env.NEBULA_SAFETY_CONFIG;
    }
    if (fs.existsSync(TEST_CONFIG)) fs.rmSync(TEST_CONFIG, { force: true });
  });

  it('should return default rules when no config file', () => {
    const rules = loadSafetyRules('./nonexistent-config.json');
    expect(rules.environments).toBeDefined();
    expect(rules.environments.development).toBeDefined();
    expect(rules.environments.production).toBeDefined();
    expect(rules.defaultEnvironment).toBe('development');
  });

  it('should load custom config file', () => {
    const custom = {
      defaultEnvironment: 'staging',
      environments: {
        staging: { allowDestructive: false, maxScore: 60, blockedPatterns: [/rm\s+-rf/] },
      },
    };
    fs.writeFileSync(TEST_CONFIG, JSON.stringify(custom));
    const rules = loadSafetyRules(TEST_CONFIG);
    expect(rules.defaultEnvironment).toBe('staging');
    expect(rules.environments.staging.maxScore).toBe(60);
  });

  it('should pick up default environment from process.env.NEBULA_ENV', () => {
    process.env.NEBULA_ENV = 'production';
    const env = getEnvironment(null, DEFAULT_RULES);
    expect(env.maxScore).toBe(30);
    expect(env.allowDestructive).toBe(false);
  });

  it('should block a command that matches a blocked pattern', () => {
    process.env.NEBULA_ENV = 'production';
    const result = evaluateCommand('rm -rf /etc/passwd');
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should allow a safe command in production', () => {
    process.env.NEBULA_ENV = 'production';
    const result = evaluateCommand('kubectl get pods');
    expect(result.allowed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should allow destructive commands in development', () => {
    process.env.NEBULA_ENV = 'development';
    const result = evaluateCommand('rm -rf /tmp/foo');
    expect(result.allowed).toBe(true);
  });

  it('should mantain thresholds per environment', () => {
    process.env.NEBULA_ENV = 'staging';
    const result = evaluateCommand('kubectl delete pod');
    expect(result.threshold).toBe(50);
  });

  it('should fall back to development environment for unknown env', () => {
    process.env.NEBULA_ENV = 'not-an-env';
    const env = getEnvironment(null, DEFAULT_RULES);
    expect(env.maxScore).toBe(DEFAULT_RULES.environments.development.maxScore);
  });
});