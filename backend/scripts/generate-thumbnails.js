#!/usr/bin/env node
// Background migration script to generate image variants for existing images and update DB rows.
// Usage: node scripts/generate-thumbnails.js

import fs from 'fs';
import path from 'path';
import { createBackblazeClient } from '../src/lib/backblaze.js';
import { query } from '../src/lib/database.js';

// CLI options: --batch N, --dry-run, --checkpoint <path>, --resume, --tables csv
const rawArgs = process.argv.slice(2);
const args = rawArgs.reduce((acc, cur, idx, arr) => {
  if (cur === '--batch' && arr[idx+1]) { acc.batch = Number(arr[idx+1]); }
  if (cur === '--dry-run') acc.dryRun = true;
  if (cur === '--resume') acc.resume = true;
  if (cur === '--checkpoint' && arr[idx+1]) acc.checkpoint = arr[idx+1];
  if (cur === '--tables' && arr[idx+1]) acc.tables = arr[idx+1].split(',').map(s => s.trim());
  return acc;
}, {});

const BATCH_SIZE = Number(args.batch || process.env.MIGRATION_BATCH_SIZE || 100);
const DRY_RUN = Boolean(args.dryRun);
const CHECKPOINT_PATH = args.checkpoint || path.join(process.cwd(), 'backend', 'migration-thumbnails-checkpoint.json');
const TABLES_FILTER = Array.isArray(args.tables) && args.tables.length > 0 ? args.tables : null;

// dynamic import sharp
const sharp = (await import('sharp')).default;

function loadCheckpoint() {
  try {
    if (!fs.existsSync(CHECKPOINT_PATH)) return {};
    const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) { return {}; }
}

function saveCheckpoint(obj) {
  try {
    fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(obj, null, 2));
  } catch (e) { console.warn('Failed to save checkpoint', e?.message || e); }
}

function parseStorageUrl(publicUrl) {
  try {
    const u = new URL(publicUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const fileIdx = parts.findIndex(p => p === 'file');
    if (fileIdx >= 0) {
      const bucket = parts[fileIdx + 1];
      const objectPath = parts.slice(fileIdx + 2).join('/');
      return { bucket, objectPath };
    }
    // fallback: assume first segment is bucket
    if (parts.length >= 2) return { bucket: parts[0], objectPath: parts.slice(1).join('/') };
  } catch (e) {}
  return { bucket: null, objectPath: null };
}

async function toBuffer(streamOrBuffer) {
  if (Buffer.isBuffer(streamOrBuffer)) return streamOrBuffer;
  const chunks = [];
  return new Promise((resolve, reject) => {
    streamOrBuffer.on('data', c => chunks.push(c));
    streamOrBuffer.on('end', () => resolve(Buffer.concat(chunks)));
    streamOrBuffer.on('error', reject);
  });
}

async function downloadFromB2(bucket, objectPath) {
  const b2 = createBackblazeClient();
  const downloader = b2.from(bucket);
  const res = await downloader.downloadStream(objectPath, null);
  if (res.error) throw new Error('download failed');
  const buf = await toBuffer(res.data);
  return buf;
}

async function uploadToB2(bucket, pathName, buffer, contentType, options = {}) {
  const b2 = createBackblazeClient();
  const uploader = b2.from(bucket);
  const uploadOpts = { contentType };
  if (options.cacheControl) uploadOpts.cacheControl = options.cacheControl;
  const resp = await uploader.upload(pathName, buffer, uploadOpts);
  if (resp.error) throw resp.error;
  const { data } = await uploader.getPublicUrl(pathName);
  return data?.publicUrl || null;
}

async function generateAndUploadVariants(bucket, objectPath, buffer) {
  const baseNoExt = objectPath.replace(/\.[^.]+$/, '');
  const sizes = [64, 320, 800];
  const out = {};
  for (const s of sizes) {
    try {
      const jpeg = await sharp(buffer).resize({ width: s, height: s, fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
      const webp = await sharp(buffer).resize({ width: s, height: s, fit: 'cover' }).webp({ quality: 75 }).toBuffer();
      const pJpg = `${baseNoExt}-${s}w.jpg`;
      const pWebp = `${baseNoExt}-${s}w.webp`;
      if (DRY_RUN) {
        out[`${s}w`] = `DRYRUN://${bucket}/${pJpg}`;
        out[`${s}w_webp`] = `DRYRUN://${bucket}/${pWebp}`;
      } else {
        out[`${s}w`] = await uploadToB2(bucket, pJpg, jpeg, 'image/jpeg', { cacheControl: 'public, max-age=31536000, immutable' });
        out[`${s}w_webp`] = await uploadToB2(bucket, pWebp, webp, 'image/webp', { cacheControl: 'public, max-age=31536000, immutable' });
      }
    } catch (e) {
      console.warn('variant failed', s, e?.message || e);
    }
  }
  // optimized original
  try {
    const maxOrig = Number(process.env.IMAGE_MAX_DIM || 2000);
    const origJpeg = await sharp(buffer).resize({ width: maxOrig, height: maxOrig, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
    const origWebp = await sharp(buffer).resize({ width: maxOrig, height: maxOrig, fit: 'inside' }).webp({ quality: 85 }).toBuffer();
    const origJpgPath = objectPath.replace(/\.[^.]+$/, '.jpg');
    const origWebpPath = objectPath.replace(/\.[^.]+$/, '.webp');
    if (DRY_RUN) {
      out.original = `DRYRUN://${bucket}/${origJpgPath}`;
      out.original_webp = `DRYRUN://${bucket}/${origWebpPath}`;
    } else {
      out.original = await uploadToB2(bucket, origJpgPath, origJpeg, 'image/jpeg', { cacheControl: 'public, max-age=31536000, immutable' });
      out.original_webp = await uploadToB2(bucket, origWebpPath, origWebp, 'image/webp', { cacheControl: 'public, max-age=31536000, immutable' });
    }
  } catch (e) { console.warn('orig upload failed', e?.message || e); }
  return out;
}

async function processRow(table, idCol, id, urlCol, url, checkpoint) {
  try {
    if (!url || typeof url !== 'string' || (url.startsWith('http://') && !url.includes('backblazeb2.com') && !url.includes('/file/'))) {
      console.log(`[skip] ${table} ${id} - external or invalid url`);
      checkpoint[table] = id;
      saveCheckpoint(checkpoint);
      return;
    }
    const { bucket, objectPath } = parseStorageUrl(url);
    if (!bucket || !objectPath) { console.log(`[skip] ${table} ${id} - cannot parse url ${url}`); checkpoint[table] = id; saveCheckpoint(checkpoint); return; }
    console.log(`Processing ${table} ${id} -> ${bucket}/${objectPath}`);
    const buf = await downloadFromB2(bucket, objectPath);
    const variants = await generateAndUploadVariants(bucket, objectPath, buf);
    const medium = variants['320w'] || variants['64w'] || variants.original || null;
    if (medium) {
      if (DRY_RUN) {
        console.log(`[dry-run] would update ${table} ${id} -> ${medium}`);
      } else {
        const sql = `UPDATE ${table} SET ${urlCol} = $2 WHERE ${idCol} = $1`;
        await query(sql, [id, medium]);
        console.log(`[updated] ${table} ${id} -> ${medium}`);
      }
    } else {
      console.log(`[no-variant] ${table} ${id}`);
    }
    // checkpoint progress after each row
    checkpoint[table] = id;
    saveCheckpoint(checkpoint);
  } catch (e) {
    console.error(`[error] ${table} ${id}`, e?.message || e);
    // still write checkpoint to avoid repeating a permanent failure on resume
    checkpoint[table] = id;
    saveCheckpoint(checkpoint);
  }
}

async function run() {
  console.log('Starting thumbnail migration...');
  const checkpoint = loadCheckpoint();

  const tables = [
    { name: 'albums', idCol: 'id', urlCol: 'cover_image' },
    { name: 'songs', idCol: 'id', urlCol: 'cover_image' },
    { name: 'videos', idCol: 'id', urlCol: 'thumbnail' },
    { name: 'users', idCol: 'id', urlCol: 'profile_image' },
  ];

  for (const t of tables) {
    if (TABLES_FILTER && TABLES_FILTER.indexOf(t.name) === -1) {
      console.log(`Skipping ${t.name} due to --tables filter`);
      continue;
    }
    console.log(`Processing table ${t.name} in batches (batch=${BATCH_SIZE})`);
    let lastId = checkpoint[t.name] || 0;
    while (true) {
      const sql = `SELECT ${t.idCol} as id, ${t.urlCol} as url FROM ${t.name} WHERE ${t.urlCol} IS NOT NULL AND ${t.idCol} > $1 ORDER BY ${t.idCol} ASC LIMIT $2`;
      const res = await query(sql, [lastId, BATCH_SIZE]);
      if (!res.rows || res.rows.length === 0) break;
      for (const r of res.rows) {
        await processRow(t.name, t.idCol, r.id, t.urlCol, r.url, checkpoint);
        lastId = checkpoint[t.name] || r.id;
      }
      // If fewer than batch rows returned, we're likely done for this table
      if (res.rows.length < BATCH_SIZE) break;
    }
  }

  console.log('Thumbnail migration complete.');
  process.exit(0);
}

run().catch(e => { console.error('Migration failed', e); process.exit(1); });
