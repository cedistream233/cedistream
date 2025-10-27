#!/usr/bin/env node
// Background migration script to generate image variants for existing images and update DB rows.
// Usage: node scripts/generate-thumbnails.js

import fs from 'fs';
import path from 'path';
import { createBackblazeClient } from '../src/lib/backblaze.js';
import { query } from '../src/lib/database.js';

// dynamic import sharp
const sharp = (await import('sharp')).default;

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

async function uploadToB2(bucket, pathName, buffer, contentType) {
  const b2 = createBackblazeClient();
  const uploader = b2.from(bucket);
  const resp = await uploader.upload(pathName, buffer, { contentType });
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
      out[`${s}w`] = await uploadToB2(bucket, pJpg, jpeg, 'image/jpeg');
      out[`${s}w_webp`] = await uploadToB2(bucket, pWebp, webp, 'image/webp');
    } catch (e) {
      console.warn('variant failed', s, e?.message || e);
    }
  }
  // optimized original
  try {
    const maxOrig = Number(process.env.IMAGE_MAX_DIM || 2000);
    const origJpeg = await sharp(buffer).resize({ width: maxOrig, height: maxOrig, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
    const origWebp = await sharp(buffer).resize({ width: maxOrig, height: maxOrig, fit: 'inside' }).webp({ quality: 85 }).toBuffer();
    out.original = await uploadToB2(bucket, objectPath.replace(/\.[^.]+$/, '.jpg'), origJpeg, 'image/jpeg');
    out.original_webp = await uploadToB2(bucket, objectPath.replace(/\.[^.]+$/, '.webp'), origWebp, 'image/webp');
  } catch (e) { console.warn('orig upload failed', e?.message || e); }
  return out;
}

async function processRow(table, idCol, id, urlCol, url) {
  try {
    if (!url || typeof url !== 'string' || url.startsWith('http://') && !url.includes('backblazeb2.com') && !url.includes('/file/')) {
      console.log(`[skip] ${table} ${id} - external or invalid url`);
      return;
    }
    const { bucket, objectPath } = parseStorageUrl(url);
    if (!bucket || !objectPath) { console.log(`[skip] ${table} ${id} - cannot parse url ${url}`); return; }
    console.log(`Processing ${table} ${id} -> ${bucket}/${objectPath}`);
    const buf = await downloadFromB2(bucket, objectPath);
    const variants = await generateAndUploadVariants(bucket, objectPath, buf);
    const medium = variants['320w'] || variants['64w'] || variants.original || null;
    if (medium) {
      const sql = `UPDATE ${table} SET ${urlCol} = $2 WHERE ${idCol} = $1`;
      await query(sql, [id, medium]);
      console.log(`[updated] ${table} ${id} -> ${medium}`);
    } else {
      console.log(`[no-variant] ${table} ${id}`);
    }
  } catch (e) {
    console.error(`[error] ${table} ${id}`, e?.message || e);
  }
}

async function run() {
  console.log('Starting thumbnail migration...');
  // Albums
  const albums = await query('SELECT id, cover_image FROM albums WHERE cover_image IS NOT NULL');
  for (const r of albums.rows) {
    await processRow('albums', 'id', r.id, 'cover_image', r.cover_image);
  }
  // Songs
  const songs = await query('SELECT id, cover_image FROM songs WHERE cover_image IS NOT NULL');
  for (const r of songs.rows) {
    await processRow('songs', 'id', r.id, 'cover_image', r.cover_image);
  }
  // Videos
  const videos = await query('SELECT id, thumbnail FROM videos WHERE thumbnail IS NOT NULL');
  for (const r of videos.rows) {
    await processRow('videos', 'id', r.id, 'thumbnail', r.thumbnail);
  }
  // Users (profile images)
  const users = await query('SELECT id, profile_image FROM users WHERE profile_image IS NOT NULL');
  for (const r of users.rows) {
    await processRow('users', 'id', r.id, 'profile_image', r.profile_image);
  }

  console.log('Thumbnail migration complete.');
  process.exit(0);
}

run().catch(e => { console.error('Migration failed', e); process.exit(1); });
