import B2 from 'backblaze-b2';
import { Readable } from 'stream';
import crypto from 'crypto';

// Simple Backblaze B2 client wrapper exposing minimal API used by the app.
// Expects env vars: BACKBLAZE_ACCOUNT_ID, BACKBLAZE_APPLICATION_KEY

const accountId = (process.env.BACKBLAZE_ACCOUNT_ID || '').trim();
// Remove surrounding quotes if present (dotenv may preserve them)
const rawAppKey = process.env.BACKBLAZE_APPLICATION_KEY || '';
const appKey = rawAppKey.trim().replace(/^["']|["']$/g, '');
const bucketName = (process.env.BACKBLAZE_BUCKET_NAME || process.env.B2_BUCKET_NAME || '').trim();

// Debug helper: only print verbose Backblaze info when BACKBLAZE_DEBUG=true
const B2_DEBUG = String(process.env.BACKBLAZE_DEBUG || '').toLowerCase() === 'true';
const mask = (s) => s && s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)} (len:${s.length})` : (s ? `(len:${s.length})` : 'MISSING');
if (B2_DEBUG) {
  console.debug('[Backblaze] Loading credentials:', {
    accountId: mask(accountId),
    appKey: mask(appKey),
    bucketNameLegacy: bucketName || '(not-set)'
  });
}

// List which per-feature buckets are configured (helps avoid confusion)
const featureBuckets = {
  MEDIA: process.env.BACKBLAZE_BUCKET_MEDIA || null,
  VIDEOS: process.env.BACKBLAZE_BUCKET_VIDEOS || null,
  PROFILES: process.env.BACKBLAZE_BUCKET_PROFILES || null,
  ALBUMS: process.env.BACKBLAZE_BUCKET_ALBUMS || null,
  PREVIEWS: process.env.BACKBLAZE_BUCKET_PREVIEWS || null,
  THUMBNAILS: process.env.BACKBLAZE_BUCKET_THUMBNAILS || null,
  PROMOTIONS: process.env.BACKBLAZE_BUCKET_PROMOTIONS || null,
};
if (B2_DEBUG) {
  console.debug('[Backblaze] Per-feature buckets:', Object.entries(featureBuckets).filter(([,v])=>v).map(([k,v])=>`${k}=${v}`).join(', ') || '(none configured)');
}

function toBuffer(streamOrBuffer) {
  if (Buffer.isBuffer(streamOrBuffer)) return Promise.resolve(streamOrBuffer);
  if (streamOrBuffer instanceof Readable) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      streamOrBuffer.on('data', (c) => chunks.push(c));
      streamOrBuffer.on('end', () => resolve(Buffer.concat(chunks)));
      streamOrBuffer.on('error', reject);
    });
  }
  // assume string
  return Promise.resolve(Buffer.from(String(streamOrBuffer)));
}

export function createBackblazeClient() {
  if (!accountId || !appKey) {
    throw new Error('Backblaze env vars missing (BACKBLAZE_ACCOUNT_ID, BACKBLAZE_APPLICATION_KEY)');
  }
  // bucketName is now optional since we use per-feature bucket env vars

  // Use explicit applicationKeyId (Backblaze recommends this for application keys)
  const b2 = new B2({ applicationKeyId: accountId, applicationKey: appKey });
  // Will be set after authorize; used to build correct public URLs (e.g., https://f003.backblazeb2.com)
  let downloadBase = null; // e.g., https://f003.backblazeb2.com

  async function ensureAuth() {
    // Avoid concurrent authorize() calls racing — serialize via authInProgress promise
    if (!b2.authorized) {
      if (ensureAuth._inProgress) {
        // another authorize() is running; wait for it
        await ensureAuth._inProgress;
        if (b2.authorized) return;
      }

      // Create a single in-progress promise so concurrent callers await the same work
      ensureAuth._inProgress = (async () => {
        try {
          // Log masked Authorization header for debugging (do not print full key)
          try {
            if (B2_DEBUG) {
              const basic = Buffer.from(`${accountId}:${appKey}`).toString('base64');
              const maskSmall = (s) => s ? `${s.slice(0,6)}...${s.slice(-6)}` : '(missing)';
              console.debug('[Backblaze] Authorization header (masked):', maskSmall(basic));
            }
          } catch (e) {
            // ignore masking errors
          }

          // Try authorize, retry once after a short backoff if we receive 401
          try {
            const res = await b2.authorize();
            downloadBase = res?.data?.downloadUrl || null;
          } catch (err) {
            const status = err?.response?.status;
            const data = err?.response?.data;
            console.warn('Backblaze authorize attempt failed, will retry once', { status, data });
            // small backoff
            await new Promise(r => setTimeout(r, 250));
            const res2 = await b2.authorize();
            downloadBase = res2?.data?.downloadUrl || null;
          }
        } catch (err) {
          const status = err?.response?.status;
          const data = err?.response?.data;
          const headers = err?.response?.headers;
          console.error('Backblaze authorization failed', { status, data, headers, message: err?.message });
          throw new Error(`Backblaze authorization failed${status ? ` (status ${status})` : ''} - check BACKBLAZE_ACCOUNT_ID and BACKBLAZE_APPLICATION_KEY`);
        } finally {
          ensureAuth._inProgress = null;
        }
      })();

      await ensureAuth._inProgress;
    }
  }

  // Cache bucket id lookup
  const bucketIdCache = new Map();
  async function getBucketId(name) {
    if (bucketIdCache.has(name)) return bucketIdCache.get(name);
    await ensureAuth();
    const { data } = await b2.listBuckets({ accountId });
    const found = data.buckets.find(b => b.bucketName === name);
    if (!found) throw new Error(`Backblaze bucket not found: ${name}`);
    bucketIdCache.set(name, found.bucketId);
    return found.bucketId;
  }

  // Returns an object with .upload(path, buffer|stream, opts) and .getPublicUrl(path)
  return {
    from: (bucket) => ({
      // Upload accepts a Buffer or Readable stream. For buffers > LARGE_UPLOAD_THRESHOLD
      // it will use B2 large file APIs (multipart) to avoid size limits.
      upload: async (path, streamOrBuffer, opts = {}) => {
        await ensureAuth();
        const contentType = opts.contentType || 'application/octet-stream';
        const data = await toBuffer(streamOrBuffer);
        const LARGE_UPLOAD_THRESHOLD = Number(process.env.BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES || 50 * 1024 * 1024); // 50MB

        if (data.length <= LARGE_UPLOAD_THRESHOLD) {
          // simple upload
          const { data: uploadUrlData } = await b2.getUploadUrl({ bucketId: await getBucketId(bucket) });
          const resp = await b2.uploadFile({
            uploadUrl: uploadUrlData.uploadUrl,
            uploadAuthToken: uploadUrlData.authorizationToken,
            filename: path,
            data,
            contentType
          });
          return { error: null, data: resp.data };
        }

        // Large file flow: startLargeFile, uploadPart(s), finishLargeFile
        const bucketId = await getBucketId(bucket);
        const start = await b2.startLargeFile({ bucketId, fileName: path, contentType });
        const fileId = start.data.fileId;

        const partSize = Number(process.env.BACKBLAZE_PART_SIZE || 10 * 1024 * 1024); // 10MB default
        const parts = [];
        const sha1List = [];
        const totalParts = Math.ceil(data.length / partSize);
        for (let i = 0; i < totalParts; i++) {
          const offset = i * partSize;
          const chunk = data.slice(offset, offset + partSize);
          const { data: uploadPartUrl } = await b2.getUploadPartUrl({ fileId });
          const partResp = await b2.uploadPart({
            uploadUrl: uploadPartUrl.uploadUrl,
            uploadAuthToken: uploadPartUrl.authorizationToken,
            partNumber: i + 1,
            data: chunk
          });
          // record sha1 for finishLargeFile
          const sha1 = crypto.createHash('sha1').update(chunk).digest('hex');
          sha1List.push(sha1);
        }

        await b2.finishLargeFile({ fileId, partSha1Array: sha1List });
        return { error: null, data: { fileId, fileName: path } };
      },
      getPublicUrl: async (path) => {
        // Build using the correct download cluster from authorize():
        //   <downloadBase>/file/<bucket>/<object>
        await ensureAuth();
        const encodePath = (p) => String(p).split('/')
          .map(seg => encodeURIComponent(seg))
          .join('/');

        // Prefer SDK-derived downloadBase; allow override via BACKBLAZE_PUBLIC_BASE if explicitly set.
        // If BACKBLAZE_PUBLIC_BASE is used, it should be the base WITHOUT bucket, typically like:
        //   https://f003.backblazeb2.com/file
        // We'll append /<bucket>/<path>.
        const envBase = (process.env.BACKBLAZE_PUBLIC_BASE || '').trim();
        const baseRoot = envBase && envBase.startsWith('http')
          ? envBase.replace(/\/?$/, '') // trim trailing slash
          : (downloadBase ? `${downloadBase}/file` : null);

        if (!baseRoot) {
          // fallback if authorize didn't set base for some reason
          return { data: { publicUrl: `https://f003.backblazeb2.com/file/${bucket}/${encodePath(path)}` }, error: null };
        }

        const publicUrl = `${baseRoot.replace(/\/$/, '')}/${bucket}/${encodePath(path)}`;
        return { data: { publicUrl }, error: null };
      },
      createSignedUrl: async (path, seconds) => {
        // For public buckets, this is identical to the Friendly URL.
        await ensureAuth();
        const encodePath = (p) => String(p).split('/').map(seg => encodeURIComponent(seg)).join('/');
        const envBase = (process.env.BACKBLAZE_PUBLIC_BASE || '').trim();
        const baseRoot = envBase && envBase.startsWith('http')
          ? envBase.replace(/\/?$/, '')
          : (downloadBase ? `${downloadBase}/file` : null);
        if (!baseRoot) {
          return { data: { signedUrl: `https://f003.backblazeb2.com/file/${bucket}/${encodePath(path)}` }, error: null };
        }
        const signedUrl = `${baseRoot.replace(/\/$/, '')}/${bucket}/${encodePath(path)}`;
        return { data: { signedUrl }, error: null };
      },
      // Download/stream helper: supports optional HTTP Range header (e.g., 'bytes=0-')
      downloadStream: async (path, rangeHeader) => {
        await ensureAuth();
        const list = await b2.listFileNames({ bucketId: await getBucketId(bucket), prefix: path, maxFileCount: 1 });
        if (!list.data.files || list.data.files.length === 0) {
          return { error: 'not_found' };
        }
        const file = list.data.files[0];
        const fileId = file.fileId;
        // Pass range if provided. The SDK supports a `range` option on downloadFileById in many versions.
        try {
          const opts = { fileId };
          if (rangeHeader) opts.range = rangeHeader;
          const resp = await b2.downloadFileById(opts);
          // resp.data is a stream in node environment; resp.headers contains content-length/type
          return { data: resp.data, headers: resp.headers || {}, info: file };
        } catch (e) {
          // Some SDK versions return the body in resp.data as Buffer
          try {
            const fallback = await b2.downloadFileById({ fileId });
            return { data: fallback.data, headers: fallback.headers || {}, info: file };
          } catch (err) {
            return { error: err };
          }
        }
      },
      remove: async (paths) => {
        await ensureAuth();
        // Need fileId to delete; list file(s) to get fileId then delete
        const results = [];
        for (const p of paths) {
          const list = await b2.listFileNames({ bucketId: await getBucketId(bucket), prefix: p, maxFileCount: 1 });
          if (list.data.files && list.data.files.length > 0) {
            const file = list.data.files[0];
            await b2.deleteFileVersion({ fileName: file.fileName, fileId: file.fileId });
            results.push({ success: true, file });
          } else {
            results.push({ success: false, error: 'not_found', path: p });
          }
        }
        return { error: null, data: results };
      }
    })
  };

  
}
