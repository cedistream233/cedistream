import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

// Load backend .env
let envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) envPath = path.resolve(process.cwd(), 'backend', '.env');
dotenv.config({ path: envPath });

async function run() {
  const acct = (process.env.BACKBLAZE_ACCOUNT_ID || '').trim();
  const app = (process.env.BACKBLAZE_APPLICATION_KEY || '').trim();
  if (!acct || !app) {
    console.error('Missing BACKBLAZE env vars');
    process.exit(2);
  }

  const b64 = Buffer.from(`${acct}:${app}`).toString('base64');
  try {
    const resp = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: `Basic ${b64}` },
      timeout: 10000
    });
    console.log('Node authorize success:', resp.status);
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Node authorize error status:', err.response.status);
      console.error('Body:', err.response.data);
    } else {
      console.error('Node authorize error:', err.message);
    }
    process.exit(1);
  }
}

run();
