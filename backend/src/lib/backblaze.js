import B2 from 'backblaze-b2';
import { Readable } from 'stream';
import crypto from 'crypto';

// Simple Backblaze B2 client wrapper exposing minimal API used by the app.
// Expects env vars: BACKBLAZE_ACCOUNT_ID, BACKBLAZE_APPLICATION_KEY, BACKBLAZE_BUCKET_NAME

const accountId = process.env.BACKBLAZE_ACCOUNT_ID;
const appKey = process.env.BACKBLAZE_APPLICATION_KEY;
const bucketName = process.env.BACKBLAZE_BUCKET_NAME || process.env.B2_BUCKET_NAME;

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
  if (!accountId || !appKey || !bucketName) {
    throw new Error('Backblaze env vars missing (BACKBLAZE_ACCOUNT_ID, BACKBLAZE_APPLICATION_KEY, BACKBLAZE_BUCKET_NAME)');
  }

  const b2 = new B2({ accountId, applicationKey: appKey });

  async function ensureAuth() {
    if (!b2.authorized) {
      await b2.authorize();
    }
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
        // Backblaze public URL pattern depends on bucket settings. We'll construct
        // a 'friendly' URL: https://f001.backblazeb2.com/file/<bucketName>/<path>
        const base = process.env.BACKBLAZE_PUBLIC_BASE || `https://f001.backblazeb2.com/file/${bucket}`;
        return { data: { publicUrl: `${base}/${encodeURIComponent(path)}` }, error: null };
      },
      createSignedUrl: async (path, seconds) => {
        // B2 doesn't offer simple signed URLs via SDK like S3; a practical approach
        // is to set the bucket to 'public' and use the public URL. For private buckets
        // you'd need a proxy endpoint that streams the file after auth. We'll return
        // the public URL when bucket is public.
        const { data } = await (async () => ({ data: { signedUrl: (process.env.BACKBLAZE_PUBLIC_BASE || `https://f001.backblazeb2.com/file/${bucket}`) + '/' + encodeURIComponent(path) } }));
        return { data, error: null };
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
}
