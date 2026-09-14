import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MEMORY_DIR = path.join(os.homedir(), '.nebula-cli');
const KEY_FILE = path.join(MEMORY_DIR, '.memory-key');
const ALGO = 'aes-256-gcm';

function getKey() {
  if (process.env.NEBULA_MEMORY_KEY && process.env.NEBULA_MEMORY_KEY.length >= 32) {
    return Buffer.from(process.env.NEBULA_MEMORY_KEY, 'hex').slice(0, 32);
  }

  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  if (fs.existsSync(KEY_FILE)) {
    return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8'), 'hex');
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  return key;
}

export function isEncryptionEnabled() {
  if (process.env.NEBULA_MEMORY_ENCRYPTION === 'false') return false;
  return true;
}

export function encryptObject(obj) {
  if (!isEncryptionEnabled()) return JSON.stringify(obj);

  const plaintext = JSON.stringify(obj);
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    _encrypted: true,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

export function decryptObject(raw) {
  if (typeof raw !== 'string') return raw;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || !parsed._encrypted) return parsed;

  try {
    const key = getKey();
    const iv = Buffer.from(parsed.iv, 'hex');
    const tag = Buffer.from(parsed.tag, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'hex')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

export function isLocalFirst() {
  if (process.env.NEBULA_MEMORY_SYNC && process.env.NEBULA_MEMORY_SYNC !== 'disabled') {
    return false;
  }
  return true;
}
