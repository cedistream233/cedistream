import B2 from 'backblaze-b2';
import { Readable } from 'stream';
import crypto from 'crypto';

// Simple Backblaze B2 client wrapper exposing minimal API used by the app.
// Supports logical bucket names (e.g. 'media') mapped to per-feature env vars
// or a single global physical bucket with logical prefixing.

const accountId = (process.env.BACKBLAZE_ACCOUNT_ID || '').trim();
const rawAppKey = process.env.BACKBLAZE_APPLICATION_KEY || '';
const appKey = rawAppKey.trim().replace(/^['"]|['"]$/g, '');
const bucketName = (process.env.BACKBLAZE_BUCKET_NAME || process.env.B2_BUCKET_NAME || '').trim();

const B2_DEBUG = String(process.env.BACKBLAZE_DEBUG || '').toLowerCase() === 'true';
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
  console.debug('[Backblaze] Bucket mapping configuration:');
  Object.entries(featureBuckets).forEach(([logical, physical]) => {
    if (physical) console.debug(`  ${logical} -> ${physical}`);
  });
}

function toBuffer(streamOrBuffer) {
  if (Buffer.isBuffer(streamOrBuffer)) return Promise.resolve(streamOrBuffer);
  if (streamOrBuffer instanceof Readable) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      streamOrBuffer.on('data', c => chunks.push(c));
      streamOrBuffer.on('end', () => resolve(Buffer.concat(chunks)));
      streamOrBuffer.on('error', reject);
    });
  }
  return Promise.resolve(Buffer.from(String(streamOrBuffer)));
}

export function createBackblazeClient() {
  if (!accountId || !appKey) {
    throw new Error('Backblaze env vars missing (BACKBLAZE_ACCOUNT_ID, BACKBLAZE_APPLICATION_KEY)');
  }

  const b2 = new B2({ applicationKeyId: accountId, applicationKey: appKey });
  let downloadBase = null;

  async function ensureAuth() {
    if (b2.authorized) return;
    if (ensureAuth._inProgress) {
      await ensureAuth._inProgress;
      return;
    }

    ensureAuth._inProgress = (async () => {
      try {
        if (B2_DEBUG) {
          try {
            const basic = Buffer.from(`${accountId}:${appKey}`).toString('base64');
            console.debug('[Backblaze] authorize (masked):', basic.slice(0, 8) + '...');
          } catch (e) {}
        }
        try {
          const res = await b2.authorize();
          downloadBase = res?.data?.downloadUrl || null;
        } catch (err) {
          // retry once after small backoff
          await new Promise(r => setTimeout(r, 250));
          const retryRes = await b2.authorize();
          downloadBase = retryRes?.data?.downloadUrl || null;
        }
      } catch (err) {
        const status = err?.response?.status;
        console.error('Backblaze authorization failed', { status, message: err?.message });
        throw new Error(`Backblaze authorization failed${status ? ` (status ${status})` : ''}`);
      } finally {
        ensureAuth._inProgress = null;
      }
    })();

    await ensureAuth._inProgress;
  }

  const bucketIdCache = new Map();
  async function getBucketId(name) {
    if (bucketIdCache.has(name)) return bucketIdCache.get(name);
    await ensureAuth();
    const { data } = await b2.listBuckets({ accountId });
    const found = (data && data.buckets) ? data.buckets.find(b => b.bucketName === name) : null;
    if (!found) throw new Error(`Backblaze bucket not found: ${name}`);
    bucketIdCache.set(name, found.bucketId);
    return found.bucketId;
  }

  // Factory for logical bucket
  return {
    from: (logicalBucket) => {
      // Resolve logical bucket name (e.g., 'media', 'previews') to physical B2 bucket
      const resolved = (() => {
        // Try uppercase mapping first (MEDIA -> BACKBLAZE_BUCKET_MEDIA)
        const key = String(logicalBucket || '').toUpperCase();
        const perFeature = featureBuckets[key] || null;
        
        if (perFeature) {
          if (B2_DEBUG) console.debug(`[Backblaze] Resolved '${logicalBucket}' -> '${perFeature}'`);
          return { physicalBucket: perFeature, prefixWithLogical: false };
        }
        
        // If using a single global bucket, prefix with logical name
        if (bucketName) {
          if (B2_DEBUG) console.debug(`[Backblaze] Using global bucket '${bucketName}' with prefix '${logicalBucket}'`);
          return { physicalBucket: bucketName, prefixWithLogical: logicalBucket && logicalBucket !== bucketName };
        }
        
        // Fallback: treat the provided name as the physical bucket
        if (B2_DEBUG) console.warn(`[Backblaze] No mapping for '${logicalBucket}', using as-is`);
        return { physicalBucket: logicalBucket, prefixWithLogical: false };
      })();

      const { physicalBucket, prefixWithLogical } = resolved;

      function buildObjectPath(path) {
        if (prefixWithLogical && logicalBucket) return `${logicalBucket}/${path}`;
        return path;
      }

      return {
        // Upload small files or large multipart when above threshold
        upload: async (path, streamOrBuffer, opts = {}) => {
          await ensureAuth();
          const data = await toBuffer(streamOrBuffer);
          const contentType = opts.contentType || 'application/octet-stream';
          const LARGE_UPLOAD_THRESHOLD = Number(process.env.BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES || 50 * 1024 * 1024);

          const objectPath = buildObjectPath(path);

          if (data.length <= LARGE_UPLOAD_THRESHOLD) {
            const { data: uploadUrlData } = await b2.getUploadUrl({ bucketId: await getBucketId(physicalBucket) });
            const resp = await b2.uploadFile({
              uploadUrl: uploadUrlData.uploadUrl,
              uploadAuthToken: uploadUrlData.authorizationToken,
              filename: objectPath,
              data,
              contentType,
            });
            return { error: null, data: resp.data };
          }

          // Large file
          const bucketId = await getBucketId(physicalBucket);
          const start = await b2.startLargeFile({ bucketId, fileName: objectPath, contentType });
          const fileId = start.data.fileId;
          const partSize = Number(process.env.BACKBLAZE_PART_SIZE || 10 * 1024 * 1024);
          const sha1List = [];
          const totalParts = Math.ceil(data.length / partSize);
          for (let i = 0; i < totalParts; i++) {
            const offset = i * partSize;
            const chunk = data.slice(offset, offset + partSize);
            const { data: uploadPartUrl } = await b2.getUploadPartUrl({ fileId });
            await b2.uploadPart({
              uploadUrl: uploadPartUrl.uploadUrl,
              uploadAuthToken: uploadPartUrl.authorizationToken,
              partNumber: i + 1,
              data: chunk,
            });
            sha1List.push(crypto.createHash('sha1').update(chunk).digest('hex'));
          }
          await b2.finishLargeFile({ fileId, partSha1Array: sha1List });
          return { error: null, data: { fileId, fileName: objectPath } };
        },

        getPublicUrl: async (path) => {
          await ensureAuth();
          const encodePath = p => String(p).split('/').map(seg => encodeURIComponent(seg)).join('/');
          const objectPath = buildObjectPath(path);
          const envBase = (process.env.BACKBLAZE_PUBLIC_BASE || '').trim();
          const baseRoot = envBase && envBase.startsWith('http') ? envBase.replace(/\/?$/, '') : (downloadBase ? `${downloadBase}/file` : null);
          if (!baseRoot) return { error: null, data: { publicUrl: `https://f003.backblazeb2.com/file/${physicalBucket}/${encodePath(objectPath)}` } };
          const publicUrl = `${baseRoot}/${physicalBucket}/${encodePath(objectPath)}`;
          return { error: null, data: { publicUrl } };
        },

        createSignedUrl: async (path, seconds = 60) => {
          // Try to create a short-lived download authorization token for the exact file.
          // If the SDK/account doesn't support it or it fails, fall back to returning
          // the public-style download URL (which will not work for private buckets).
          await ensureAuth();
          const encodePath = p => String(p).split('/').map(seg => encodeURIComponent(seg)).join('/');
          const objectPath = buildObjectPath(path);
          try {
            // Use bucketId + prefix to create a download authorization token scoped to this file
            const bucketId = await getBucketId(physicalBucket);
            if (typeof b2.getDownloadAuthorization === 'function') {
              // fileNamePrefix should allow exact file; some SDKs accept fileNamePrefix
              const authRes = await b2.getDownloadAuthorization({ bucketId, fileNamePrefix: objectPath, validDurationInSeconds: Math.max(60, Number(seconds || 60)) });
              const token = authRes?.data?.authorizationToken || authRes?.data?.authorization || null;
              // build URL: downloadBase/file/<bucket>/<encodedPath>?Authorization=<token>
              const baseRoot = (process.env.BACKBLAZE_PUBLIC_BASE || '').trim() || (downloadBase ? `${downloadBase}/file` : null);
              const publicRoot = baseRoot || `https://f003.backblazeb2.com/file`;
              if (token && baseRoot) {
                const signedUrl = `${publicRoot}/${physicalBucket}/${encodePath(objectPath)}?Authorization=${encodeURIComponent(token)}`;
                return { error: null, data: { signedUrl } };
              }
            }
          } catch (err) {
            if (B2_DEBUG) console.warn('[Backblaze] getDownloadAuthorization failed', err?.message || err);
            // fall through to public url fallback below
          }

          // Fallback: return the public-style URL (may not work for private buckets)
          const envBase = (process.env.BACKBLAZE_PUBLIC_BASE || '').trim();
          const baseRoot = envBase && envBase.startsWith('http') ? envBase.replace(/\/?$/, '') : (downloadBase ? `${downloadBase}/file` : null);
          if (!baseRoot) return { error: null, data: { signedUrl: `https://f003.backblazeb2.com/file/${physicalBucket}/${encodePath(objectPath)}` } };
          const signedUrl = `${baseRoot}/${physicalBucket}/${encodePath(objectPath)}`;
          return { error: null, data: { signedUrl } };
        },

        downloadStream: async (path, rangeHeader) => {
          await ensureAuth();
          const objectPrefix = buildObjectPath(path);
          const list = await b2.listFileNames({ bucketId: await getBucketId(physicalBucket), prefix: objectPrefix, maxFileCount: 1 });
          if (!list.data.files || list.data.files.length === 0) return { error: 'not_found' };
          const file = list.data.files[0];
          const fileId = file.fileId;
          try {
            const opts = { fileId };
            if (rangeHeader) opts.range = rangeHeader;
            const resp = await b2.downloadFileById(opts);
            return { error: null, data: resp.data, headers: resp.headers || {}, info: file };
          } catch (err) {
            try {
              const fallback = await b2.downloadFileById({ fileId });
              return { error: null, data: fallback.data, headers: fallback.headers || {}, info: file };
            } catch (e) {
              return { error: e };
            }
          }
        },

        remove: async (paths) => {
          await ensureAuth();
          const results = [];
          for (const p of paths) {
            const objectPath = buildObjectPath(p);
            const list = await b2.listFileNames({ bucketId: await getBucketId(physicalBucket), prefix: objectPath, maxFileCount: 1 });
            if (list.data.files && list.data.files.length > 0) {
              const file = list.data.files[0];
              await b2.deleteFileVersion({ fileName: file.fileName, fileId: file.fileId });
              results.push({ success: true, file });
            } else {
              results.push({ success: false, error: 'not_found', path: p });
            }
          }
          return { error: null, data: results };
        },
      };
    }
  };
}

