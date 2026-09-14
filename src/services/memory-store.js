import fs from 'fs';
import path from 'path';
import os from 'os';
import { encryptObject, decryptObject, isEncryptionEnabled, isLocalFirst } from '../utils/memory-crypto.js';

const MEMORY_DIR = path.join(os.homedir(), '.nebula-cli', 'memory');
const NAMESPACED_DB = path.join(MEMORY_DIR, 'projects.json');
const VECTOR_DB = path.join(os.homedir(), '.nebula-cli', 'vector.db');

const PATTERN_DB = path.join(MEMORY_DIR, 'patterns.json');

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function loadNamespacedDB() {
  if (!fs.existsSync(NAMESPACED_DB)) return { projectFixes: {}, globalFixes: [], version: '4.3' };
  try {
    const raw = fs.readFileSync(NAMESPACED_DB, 'utf8');
    const decrypted = decryptObject(raw);
    if (decrypted && decrypted.projectFixes) return decrypted;
    return { projectFixes: {}, globalFixes: [], version: '4.3' };
  } catch {
    return { projectFixes: {}, globalFixes: [], version: '4.3' };
  }
}

function saveNamespacedDB(data) {
  ensureDir();
  fs.writeFileSync(NAMESPACED_DB, encryptObject(data));
}

function loadVectorDB() {
  if (!fs.existsSync(VECTOR_DB)) return [];
  try {
    const raw = fs.readFileSync(VECTOR_DB, 'utf8');
    const decrypted = decryptObject(raw);
    if (Array.isArray(decrypted)) return decrypted;
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveVectorDB(data) {
  ensureDir();
  fs.writeFileSync(VECTOR_DB, encryptObject(data));
}

function loadPatterns() {
  if (!fs.existsSync(PATTERN_DB)) return {};
  try {
    const raw = fs.readFileSync(PATTERN_DB, 'utf8');
    const decrypted = decryptObject(raw);
    if (decrypted && typeof decrypted === 'object') return decrypted;
    return {};
  } catch {
    return {};
  }
}

function savePatterns(data) {
  ensureDir();
  fs.writeFileSync(PATTERN_DB, encryptObject(data));
}

export function getMemoryStats() {
  ensureDir();
  const ns = loadNamespacedDB();
  const vec = loadVectorDB();

  let totalProjectFixes = 0;
  for (const pid of Object.keys(ns.projectFixes)) {
    totalProjectFixes += (ns.projectFixes[pid] || []).length;
  }

  return {
    projects: Object.keys(ns.projectFixes).length,
    projectFixes: totalProjectFixes,
    globalFixes: (ns.globalFixes || []).length,
    vectorFixes: vec.length,
    encryption: isEncryptionEnabled(),
    localOnly: isLocalFirst(),
  };
}

export function listMemory(projectUUID, limit = 20) {
  ensureDir();
  const ns = loadNamespacedDB();
  const entries = [];

  if (projectUUID && ns.projectFixes[projectUUID]) {
    entries.push(
      ...ns.projectFixes[projectUUID].map(e => ({
        ...e,
        tier: 'project',
      }))
    );
  }

  for (const e of (ns.globalFixes || [])) {
    entries.push({ ...e, tier: 'global' });
  }

  const vec = loadVectorDB();
  for (const e of vec.slice(-50)) {
    entries.push({ ...e, tier: 'vector' });
  }

  return entries
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export function detectPatterns(projectUUID) {
  ensureDir();
  const ns = loadNamespacedDB();
  const patterns = loadPatterns();
  const projectFixes = projectUUID ? (ns.projectFixes[projectUUID] || []) : [];
  const allFixes = [...projectFixes, ...(ns.globalFixes || [])];

  const today = new Date().toISOString().split('T')[0];

  for (const fix of allFixes) {
    const cmd = (fix.command || '').trim();
    if (!cmd) continue;

    const patternKey = `${projectUUID || 'global'}:${cmd.slice(0, 50)}`;
    const fixesNow = allFixes.filter(f => (f.command || '').trim() === cmd);
    if (!patterns[patternKey]) {
      patterns[patternKey] = { command: cmd, count: 0, dates: [] };
    }
    patterns[patternKey].count = fixesNow.length;

    const fixDate = (fix.timestamp || '').split('T')[0];
    if (fixDate === today && !patterns[patternKey].dates.includes(today)) {
      patterns[patternKey].dates.push(today);
    }
  }

  const threshold = parseInt(process.env.NEBULA_PATTERN_THRESHOLD, 10) || 5;
  const suggestions = [];

  for (const key of Object.keys(patterns)) {
    const p = patterns[key];
    if (p.count >= threshold && p.dates.includes(today)) {
      suggestions.push({
        command: p.command,
        count: p.count,
        message: `You've fixed "${p.command.slice(0, 40)}..." ${p.count} times — want to alias it?`,
      });
    }
  }

  savePatterns(patterns);
  return suggestions;
}

export function recordCommandUsage(command, projectUUID) {
  ensureDir();
  const patternKey = `${projectUUID || 'global'}:${command.trim().slice(0, 50)}`;
  const patterns = loadPatterns();
  const today = new Date().toISOString().split('T')[0];

  if (!patterns[patternKey]) {
    patterns[patternKey] = { command: command.trim(), count: 0, dates: [] };
  }
  patterns[patternKey].count++;
  if (!patterns[patternKey].dates.includes(today)) {
    patterns[patternKey].dates.push(today);
  }

  savePatterns(patterns);
  return patterns[patternKey];
}

export function exportMemory(filePath) {
  ensureDir();
  const ns = loadNamespacedDB();
  const vec = loadVectorDB();
  const patterns = loadPatterns();

  const exportData = {
    _nebulaExport: true,
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {
      namespaced: ns,
      vector: vec.slice(-500),
      patterns,
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
  return {
    projects: Object.keys(ns.projectFixes || {}).length,
    fixes: vec.length + Object.values(ns.projectFixes || {}).reduce((s, arr) => s + arr.length, 0),
    file: filePath,
  };
}

export function importMemory(filePath, overwrite = false) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Import file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const importData = JSON.parse(content);

  if (!importData._nebulaExport) {
    throw new Error('Invalid Nebula memory export file');
  }

  ensureDir();

  if (overwrite) {
    if (importData.data.namespaced) saveNamespacedDB(importData.data.namespaced);
    if (importData.data.vector) saveVectorDB(importData.data.vector);
    if (importData.data.patterns) savePatterns(importData.data.patterns);
  } else {
    const ns = loadNamespacedDB();
    for (const pid of Object.keys(importData.data.namespaced?.projectFixes || {})) {
      ns.projectFixes[pid] = [...(ns.projectFixes[pid] || []), ...(importData.data.namespaced.projectFixes[pid] || [])];
      ns.projectFixes[pid] = ns.projectFixes[pid].slice(-500);
    }
    ns.globalFixes = [...(ns.globalFixes || []), ...(importData.data.namespaced?.globalFixes || [])].slice(-200);
    saveNamespacedDB(ns);

    const vec = loadVectorDB();
    const newVec = [...vec, ...(importData.data.vector || [])].slice(-2000);
    saveVectorDB(newVec);
  }

  return { status: 'ok', overwrite };
}

export function forgetMemory(idOrCommand) {
  const ns = loadNamespacedDB();
  let deleted = 0;

  for (const pid of Object.keys(ns.projectFixes)) {
    const before = ns.projectFixes[pid].length;
    ns.projectFixes[pid] = ns.projectFixes[pid].filter(
      e => e.id?.toString() !== idOrCommand && e.command !== idOrCommand
    );
    deleted += before - ns.projectFixes[pid].length;
  }

  const beforeGlobal = (ns.globalFixes || []).length;
  ns.globalFixes = (ns.globalFixes || []).filter(
    e => e.id?.toString() !== idOrCommand && e.command !== idOrCommand
  );
  deleted += beforeGlobal - (ns.globalFixes || []).length;

  const vec = loadVectorDB();
  const vecBefore = vec.length;
  const filtered = vec.filter(
    e => e.id?.toString() !== idOrCommand && e.command !== idOrCommand
  );
  saveVectorDB(filtered);
  deleted += vecBefore - filtered.length;

  saveNamespacedDB(ns);
  return { deleted };
}

export function getRecentLearning(projectUUID) {
  const entries = listMemory(projectUUID, 3);
  if (entries.length === 0) return null;
  const latest = entries[0];
  return {
    command: latest.command,
    fix: latest.fix,
    timestamp: latest.timestamp,
  };
}
