import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ORIGINAL_HOME = process.env.HOME;
let tmpHome;
let store;

beforeEach(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-mem-test-'));
  process.env.HOME = tmpHome;
  vi.resetModules();

  const mod = await import('../../src/services/memory-store.js');
  store = mod;
});

afterEach(() => {
  if (ORIGINAL_HOME) process.env.HOME = ORIGINAL_HOME;
  else delete process.env.HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('memory-store', () => {
  it('should export memory stats', () => {
    const stats = store.getMemoryStats();
    expect(stats).toHaveProperty('projects');
    expect(stats).toHaveProperty('projectFixes');
    expect(stats).toHaveProperty('globalFixes');
    expect(stats).toHaveProperty('vectorFixes');
    expect(stats.encryption).toBe(true);
    expect(stats.localOnly).toBe(true);
  });

  it('should export and import memory across machines', () => {
    const memDir = path.join(tmpHome, '.nebula-cli', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(
      path.join(memDir, 'projects.json'),
      JSON.stringify({
        projectFixes: {
          pid1: [{ id: '1', command: 'npm build', fix: 'npm ci --force', timestamp: new Date().toISOString() }],
        },
        globalFixes: [],
        version: '4.3',
      })
    );

    const exportPath = path.join(tmpHome, 'nebula-memory-export.json');

    const result = store.exportMemory(exportPath);
    expect(result).toHaveProperty('file', exportPath);
    expect(fs.existsSync(exportPath)).toBe(true);

    const imported = store.importMemory(exportPath, true);
    expect(imported).toEqual({ status: 'ok', overwrite: true });

    const stats = store.getMemoryStats();
    expect(stats.projects).toBe(1);
    expect(stats.projectFixes).toBe(1);
  });

  it('should detect repeated patterns after a threshold', () => {
    const memDir = path.join(tmpHome, '.nebula-cli', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const today = new Date().toISOString().split('T')[0];

    const fixes = [];
    for (let i = 0; i < 5; i++) {
      fixes.push({
        id: `f${i}`,
        command: 'docker compose up -d',
        fix: 'docker compose up -d -p 5433:5432',
        timestamp: `${today}T10:00:00.000Z`,
      });
    }

    fs.writeFileSync(
      path.join(memDir, 'projects.json'),
      JSON.stringify({ projectFixes: { pid1: fixes }, globalFixes: [], version: '4.3' })
    );

    const suggestions = store.detectPatterns('pid1');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].count).toBeGreaterThanOrEqual(5);
  });

  it('should forget memory by command', () => {
    const memDir = path.join(tmpHome, '.nebula-cli', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(
      path.join(memDir, 'projects.json'),
      JSON.stringify({
        projectFixes: {
          pid1: [{ id: '1', command: 'git push', fix: 'git pull --rebase origin main', timestamp: new Date().toISOString() }],
        },
        globalFixes: [],
        version: '4.3',
      })
    );

    const result = store.forgetMemory('git push');
    expect(result.deleted).toBe(1);
    expect(store.listMemory('pid1').length).toBe(0);
  });

  it('should reject invalid import files', () => {
    expect(() => store.importMemory('/nonexistent/file.json', true)).toThrow(
      'Import file not found'
    );
  });
});