import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logAudit, readAuditEntries, queryAudit, exportAudit, getAuditFilePath } from '../../src/utils/audit-logger.js';

const ORIGINAL_DIR = process.env.NEBULA_AUDIT_DIR;
const TEST_DIR = path.join(os.tmpdir(), 'nebula-audit-test-' + Date.now());

describe('audit-logger', () => {
  beforeEach(() => {
    process.env.NEBULA_AUDIT_DIR = TEST_DIR;
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (ORIGINAL_DIR) process.env.NEBULA_AUDIT_DIR = ORIGINAL_DIR;
    else delete process.env.NEBULA_AUDIT_DIR;
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should log an audit entry', () => {
    const id = logAudit({ command: 'ls -la', risk: 'low', score: 0, outcome: 'success' });
    expect(id).toBeTruthy();
    const entries = readAuditEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].command).toBe('ls -la');
    expect(entries[0].risk).toBe('low');
    expect(entries[0].outcome).toBe('success');
    expect(entries[0].score).toBe(0);
    expect(entries[0].user).toBeTruthy();
    expect(entries[0].timestamp).toBeTruthy();
  });

  it('should append multiple entries', () => {
    logAudit({ command: 'one', risk: 'low', outcome: 'success' });
    logAudit({ command: 'two', risk: 'high', outcome: 'blocked' });
    expect(readAuditEntries().length).toBe(2);
  });

  it('should query by command substring', () => {
    logAudit({ command: 'kubectl get pods', risk: 'low', outcome: 'success' });
    logAudit({ command: 'npm install', risk: 'medium', outcome: 'failed' });
    const results = queryAudit({ command: 'kubectl' });
    expect(results.length).toBe(1);
    expect(results[0].command).toBe('kubectl get pods');
  });

  it('should query by risk level', () => {
    logAudit({ command: 'one', risk: 'low', outcome: 'success' });
    logAudit({ command: 'two', risk: 'critical', outcome: 'blocked' });
    const results = queryAudit({ risk: 'critical' });
    expect(results.length).toBe(1);
    expect(results[0].risk).toBe('critical');
  });

  it('should query by outcome', () => {
    logAudit({ command: 'one', risk: 'low', outcome: 'dry-run' });
    logAudit({ command: 'two', risk: 'low', outcome: 'success' });
    const results = queryAudit({ outcome: 'dry-run' });
    expect(results.length).toBe(1);
    expect(results[0].command).toBe('one');
  });

  it('should export to JSON', () => {
    logAudit({ command: 'test cmd', risk: 'medium', score: 50, outcome: 'failed' });
    const file = exportAudit({ format: 'json' });
    expect(fs.existsSync(file)).toBe(true);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.length).toBe(1);
    expect(data[0].command).toBe('test cmd');
  });

  it('should export to CSV', () => {
    logAudit({ command: 'csv cmd', risk: 'high', score: 90, outcome: 'blocked', user: 'tester' });
    const file = exportAudit({ format: 'csv' });
    expect(fs.existsSync(file)).toBe(true);
    const csv = fs.readFileSync(file, 'utf8');
    expect(csv).toContain('command');
    expect(csv).toContain('csv cmd');
  });
});