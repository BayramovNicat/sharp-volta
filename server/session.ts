import { Database } from 'bun:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MattermostSession } from './types';

const COOKIES_PATH = path.join(
  os.homedir(),
  'Library/Containers/Mattermost.Desktop/Data/Library/Application Support/Mattermost/Cookies'
);

let cachedPassword: string | null = null;
let cachedKey: Buffer | null = null;
let cachedSession: MattermostSession | null = null;
let lastSessionRead = 0;
const sessionChangeListeners = new Set<(session: MattermostSession) => void>();

export function getKeychainPassword(): string | null {
  if (cachedPassword) return cachedPassword;
  if (process.env.MATTERMOST_KEYCHAIN_PASSWORD) {
    cachedPassword = process.env.MATTERMOST_KEYCHAIN_PASSWORD.trim();
    return cachedPassword;
  }
  try {
    const proc = Bun.spawnSync([
      'security',
      'find-generic-password',
      '-s',
      'Mattermost Safe Storage',
      '-w',
    ]);
    const pass = proc.stdout.toString().trim();
    if (pass) {
      cachedPassword = pass;
      return cachedPassword;
    }
  } catch (err) {
    console.error('Failed to read Keychain password:', err);
  }
  return null;
}

function getDerivedKey(password: string): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  return cachedKey;
}

export function decryptCookie(encryptedHex: string, keychainPassword: string): string {
  if (!encryptedHex) return '';
  const buf = Buffer.from(encryptedHex, 'hex');
  if (buf.length < 3) return '';

  const prefix = buf.subarray(0, 3).toString('utf8');
  if (prefix !== 'v10') {
    return buf.toString('utf8');
  }

  const key = getDerivedKey(keychainPassword);
  const iv = Buffer.alloc(16, 0x20);

  const ciphertext = buf.subarray(3);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (decrypted.length > 32) {
      const candidate = decrypted.subarray(32).toString('utf8');
      if (/^[\x20-\x7E]+$/.test(candidate)) {
        return candidate;
      }
    }
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function getMattermostSession(forceRefresh = false): MattermostSession {
  const now = Date.now();
  if (!forceRefresh && cachedSession && now - lastSessionRead < 30000) {
    return cachedSession;
  }

  const password = getKeychainPassword();
  if (!password) {
    throw new Error('Could not retrieve Mattermost Safe Storage keychain password.');
  }

  const db = new Database(COOKIES_PATH, { readonly: true });
  try {
    const hostFilter = process.env.MATTERMOST_HOST_FILTER?.trim() || '%';
    const query = db.query(
      'SELECT host_key, name, hex(encrypted_value) as val FROM cookies WHERE name IN ("MMAUTHTOKEN", "MMCSRF", "MMUSERID", "lang") AND host_key LIKE $host'
    );
    const rows = query.all({ $host: hostFilter }) as Array<{ host_key: string; name: string; val: string }>;

    let detectedHost = '';
    const session: MattermostSession = {
      baseUrl: process.env.MATTERMOST_URL?.trim() || '',
      token: '',
      csrfToken: '',
      userId: '',
      lang: 'en',
    };

    for (const row of rows) {
      const decrypted = decryptCookie(row.val, password);
      if (row.name === 'MMAUTHTOKEN') {
        session.token = decrypted;
        if (row.host_key) {
          detectedHost = row.host_key.replace(/^\./, '');
        }
      } else if (row.name === 'MMCSRF') {
        session.csrfToken = decrypted;
      } else if (row.name === 'MMUSERID') {
        session.userId = decrypted;
      } else if (row.name === 'lang') {
        session.lang = decrypted;
      }
    }

    if (!session.token) {
      throw new Error('MMAUTHTOKEN not found in Mattermost Cookies database.');
    }

    if (!session.baseUrl) {
      session.baseUrl = detectedHost ? `https://${detectedHost}` : 'http://localhost:8065';
    }

    const prevToken = cachedSession?.token;
    cachedSession = session;
    lastSessionRead = now;

    if (prevToken && prevToken !== session.token) {
      console.log('[Session] Detected token refresh from Mattermost desktop!');
      for (const listener of sessionChangeListeners) {
        try {
          listener(session);
        } catch {}
      }
    }

    return session;
  } finally {
    db.close();
  }
}

export function onSessionChange(callback: (session: MattermostSession) => void): () => void {
  sessionChangeListeners.add(callback);
  return () => sessionChangeListeners.delete(callback);
}

try {
  let watchDebounce: ReturnType<typeof setTimeout> | null = null;
  const cookieDir = path.dirname(COOKIES_PATH);
  fs.watch(cookieDir, (_eventType, filename) => {
    if (filename && filename.includes('Cookies')) {
      if (watchDebounce) clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        try {
          getMattermostSession(true);
        } catch {}
      }, 500);
    }
  });
} catch (e: unknown) {
  const err = e instanceof Error ? e.message : String(e);
  console.warn('[Session] Could not attach file watcher on Cookies directory:', err);
}
