import B2 from 'backblaze-b2';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

let envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) envPath = path.resolve(process.cwd(), 'backend', '.env');
dotenv.config({ path: envPath });

const accountId = (process.env.BACKBLAZE_ACCOUNT_ID || '').trim();
const appKey = (process.env.BACKBLAZE_APPLICATION_KEY || '').trim();

async function run(){
  try{
    const b2 = new B2({ accountId, applicationKey: appKey });
    const res = await b2.authorize();
    console.log('SDK authorize success:', res.data.apiUrl, res.data.downloadUrl);
  } catch(err){
    console.error('SDK authorize failed:');
    console.error(err?.response?.status, err?.response?.data || err.message);
    process.exit(1);
  }
}

run();
