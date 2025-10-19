dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Determine .env path: prefer ./backend/.env when run from repo root
let envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) envPath = path.resolve(process.cwd(), 'backend', '.env');
dotenv.config({ path: envPath });

async function run() {
  try {
    const { createBackblazeClient } = await import('../src/lib/backblaze.js');
    const b2 = createBackblazeClient();
    const bucket = process.env.BACKBLAZE_BUCKET_PROFILES || process.env.BACKBLAZE_BUCKET_NAME || 'cedistream-profiles';
    const filename = `profiles/test-upload-${Date.now()}.txt`;
    const data = Buffer.from('hello backblaze test');
    console.log('Uploading to bucket:', bucket, 'path:', filename);
    const res = await b2.from(bucket).upload(filename, data, { contentType: 'text/plain' });
    console.log('Upload result:', res);
    const publicUrl = (await b2.from(bucket).getPublicUrl(filename)).data.publicUrl;
    console.log('Public URL:', publicUrl);
  } catch (err) {
    console.error('Upload test failed:', err);
    process.exit(1);
  }
}

run();
