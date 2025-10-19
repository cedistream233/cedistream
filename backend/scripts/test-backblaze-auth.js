import B2 from 'backblaze-b2';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend folder so this script works when run directly
// The project's backend env lives in ./backend/.env; ensure we load that file
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

async function test() {
  const accountId = process.env.BACKBLAZE_ACCOUNT_ID;
  const appKey = process.env.BACKBLAZE_APPLICATION_KEY;
  if (!accountId || !appKey) {
    console.error('Missing BACKBLAZE_ACCOUNT_ID or BACKBLAZE_APPLICATION_KEY in environment');
    process.exit(2);
  }
  const b2 = new B2({ accountId, applicationKey: appKey });
  try {
    const res = await b2.authorize();
    console.log('Authorize success:', {
      apiUrl: res.data.apiUrl,
      downloadUrl: res.data.downloadUrl,
      allowed: res.data.allowed
    });
  } catch (err) {
    console.error('Authorize failed:', err?.response?.status, err?.response?.data || err.message);
    process.exit(1);
  }
}

// Run directly when executed as a script
test().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
