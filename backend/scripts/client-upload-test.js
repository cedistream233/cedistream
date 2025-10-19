import fs from 'fs';
import path from 'path';

// Uses Node's global fetch and FormData (Node 18+). No external deps required.
async function run(){
  const tmp = path.join(process.cwd(),'tmp-upload-test.txt');
  fs.writeFileSync(tmp, 'upload test');
  const form = new globalThis.FormData();
  form.append('image', fs.createReadStream(tmp));

  // Use PORT env if set (server falls back to 5000/5001). Default to 5000.
  const port = process.env.PORT || 5000;
  const url = `http://localhost:${port}/api/auth/profile/image`;
  console.log('Posting to', url);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFmMGU4ODY5LWQ4Y2YtNGVmMy04YmI2LTgyYjVlMmVkY2I5ZSIsImVtYWlsIjoic3VwcG9ydGVyMkBnbWFpbC5jb20iLCJ1c2VybmFtZSI6InN1cHBvcnRlcjIiLCJyb2xlIjoic3VwcG9ydGVyIiwiaWF0IjoxNzYwODE0NTc2LCJleHAiOjE3NjE0MTkzNzZ9._ep1BJnqzEY2ky7ZQ4Gwey4gP7gT45fZYnjqyXMvwqc' },
      body: form
    });
    console.log('status', res.status);
    console.log(await res.text());
  } catch (err) {
    console.error('fetch failed', err);
    process.exit(1);
  }
}
run().catch(e=>{console.error(e); process.exit(1);});
