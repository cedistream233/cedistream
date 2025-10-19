#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import B2 from 'backblaze-b2';

// Load backend/.env reliably
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: true });

const accountId = (process.env.BACKBLAZE_ACCOUNT_ID || '').trim();
const appKey = process.env.BACKBLAZE_APPLICATION_KEY ?? '';

const mask = (s) => s ? `${s.slice(0,4)}...${s.slice(-4)} (len:${s.length})` : '(missing)';
console.log('AccountId (masked):', mask(accountId));
console.log('AppKey length:', appKey.length);

const raw = appKey;
const trimmed = raw.trim();
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
console.log('raw len:', raw.length, 'trim len:', trimmed.length);
console.log('raw sha256 (masked):', mask(hash(raw)));
console.log('trimmed sha256 (masked):', mask(hash(trimmed)));

async function run() {
  if (!accountId || !trimmed) {
    console.error('Missing accountId or applicationKey in .env');
    process.exit(2);
  }

  const b2 = new B2({ accountId, applicationKey: trimmed });
  try {
    const res = await b2.authorize();
    console.log('Authorize success:');
    console.log({ apiUrl: res.data.apiUrl, downloadUrl: res.data.downloadUrl, allowed: res.data.allowed || null });
    process.exit(0);
  } catch (err) {
    console.error('Authorize failed:', err?.response?.status, err?.response?.data || err.message);
    process.exit(3);
  }
}

run();
