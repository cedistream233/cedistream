Backblaze B2 integration

This project includes a lightweight Backblaze B2 client shim that can be used as
a drop-in replacement for the Supabase Storage subset used by the app.

Required environment variables (set in your deployment / .env):

- BACKBLAZE_ACCOUNT_ID - your Backblaze account ID
- BACKBLAZE_APPLICATION_KEY - application key for B2
- BACKBLAZE_BUCKET_NAME - the bucket name to use (e.g. "media")
- BACKBLAZE_PUBLIC_BASE (optional) - base URL for public file access. Defaults to
  the common pattern https://f001.backblazeb2.com/file/<bucket>

How it works
- When the above env vars are present the project will create a Backblaze client
  and override `supabase.storage.from(bucket)` to use the Backblaze implementation.
- The shim implements the minimal methods used by the app: `upload`, `getPublicUrl`,
  `createSignedUrl` (returns public URL for public buckets) and `remove`.

Migration strategy
1. Configure a Backblaze bucket and set the env vars.
2. For each file in Supabase storage you want to migrate: download the object and
   upload it to Backblaze with the same path/key. You can write a small migration
   script using the endpoints in `backend/src/routes/uploads.js` to fetch and re-upload, or
   use a server-side script that lists objects and copies them.
3. Update environment variables to remove Supabase storage variables (optional).
4. Test uploads, signed URLs, and deletes.

Notes & limitations
- This shim prefers public buckets for serving files. If you require time-limited
  signed URLs for private buckets, create a proxy endpoint that streams files after
  checking auth and use B2's downloadById or S3-compatible gateway as needed.
- The implementation here is intentionally small to minimize changes. For production
  consider robust retrying, multipart uploads for large files, and better error handling.

Contact
If you want, I can add a migration script and update the upload routes to call the
Backblaze client directly (removing the supabase indirection).