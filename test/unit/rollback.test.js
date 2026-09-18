import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createSnapshot, restoreSnapshot, listSnapshots, deleteSnapshot, withRollback } from '../../src/utils/rollback.js';

const ORIGINAL_DIR = process.env.NEBULA_SNAPSHOT_DIR;
const TEST_DIR = path.join(os.tmpdir(), 'nebula-rollback-test-' + Date.now());

describe('rollback', () => {
  let workDir;

  beforeEach(() => {
    process.env.NEBULA_SNAPSHOT_DIR = path.join(TEST_DIR, 'snapshots');
    workDir = path.join(TEST_DIR, 'work');
    fs.mkdirSync(workDir, { recursive: true });
  });

  afterEach(() => {
    if (ORIGINAL_DIR) process.env.NEBULA_SNAPSHOT_DIR = ORIGINAL_DIR;
    else delete process.env.NEBULA_SNAPSHOT_DIR;
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should create a snapshot manifest', () => {
    const file = path.join(workDir, 'app.js');
    fs.writeFileSync(file, 'console.log("hi")');
    const id = createSnapshot([file], { reason: 'test' });
    expect(id).toBeTruthy();
    const manifestPath = path.join(process.env.NEBULA_SNAPSHOT_DIR, id, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('should restore a file to its snapshot state', () => {
    const file = path.join(workDir, 'config.json');
    fs.writeFileSync(file, '{"version":1}');
    const id = createSnapshot([file], { reason: 'test' });

    fs.writeFileSync(file, '{"version":2}');
    const result = restoreSnapshot(id);
    expect(result.restored).toContain(file);
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(content.version).toBe(1);
  });

  it('should list available snapshots', () => {
    const file = path.join(workDir, 'a.txt');
    fs.writeFileSync(file, 'aaa');
    createSnapshot([file], { reason: 'first' });
    createSnapshot([file], { reason: 'second' });
    const snapshots = listSnapshots();
    expect(snapshots.length).toBe(2);
    expect(snapshots[0].reason).toBe('second');
  });

  it('should delete a snapshot', () => {
    const file = path.join(workDir, 'b.txt');
    fs.writeFileSync(file, 'bbb');
    const id = createSnapshot([file], { reason: 'to-delete' });
    expect(deleteSnapshot(id)).toBe(true);
    expect(listSnapshots().length).toBe(0);
  });

  it('should throw for nonexistent snapshot restore', () => {
    expect(() => restoreSnapshot('does-not-exist-123')).toThrow();
  });

  it('should auto-rollback on failure with withRollback', async () => {
    const file = path.join(workDir, 'app.js');
    fs.writeFileSync(file, 'original');
    const fakeFn = async () => {
      fs.writeFileSync(file, 'modified');
      throw new Error('boom');
    };
    const result = await withRollback([file], 'test command', fakeFn);
    expect(result.rolledBack).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('original');
  });
});