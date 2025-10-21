#!/usr/bin/env node
/**
 * postprocess-video.js
 * Worker script to transcode an uploaded MP4 into a web-optimized HQ (faststart)
 * and a small SD version (360p). Uploads results to Backblaze and updates DB.
 *
 * Usage: node backend/scripts/postprocess-video.js <localFilePath> <videoId>
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createBackblazeClient } from '../src/lib/backblaze.js';
import { query } from '../src/lib/database.js';

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: 'inherit' });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code))));
    p.on('error', err => reject(err));
  });
}

async function uploadFile(bucket, objectPath, localPath, contentType='video/mp4') {
  const b2 = createBackblazeClient();
  const stream = fs.createReadStream(localPath);
  const res = await b2.from(bucket).upload(objectPath, stream, { contentType });
  if (res.error) throw res.error;
  const pub = await b2.from(bucket).getPublicUrl(objectPath);
  return pub?.data?.publicUrl || null;
}

async function main() {
  const input = process.argv[2];
  const videoId = process.argv[3];
  if (!input || !videoId) {
    console.error('Usage: node postprocess-video.js <localPath> <videoId>');
    process.exit(2);
  }
  const tmpDir = path.join(process.cwd(), 'tmp', `video_${videoId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const sdPath = path.join(tmpDir, 'sd-360p.mp4');
  const hqPath = path.join(tmpDir, 'hq-faststart.mp4');

  try {
    // SD 360p
    await runFFmpeg([
      '-i', input,
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '600k', '-maxrate', '700k', '-bufsize', '1200k',
      '-vf', 'scale=640:-2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', sdPath
    ]);

    // HQ faststart (re-mux or re-encode if necessary)
    await runFFmpeg([
      '-i', input,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', hqPath
    ]);

    const bucket = process.env.BACKBLAZE_BUCKET_VIDEOS || process.env.BACKBLAZE_BUCKET_NAME;
    const sdObject = `videos/${videoId}/sd-360p.mp4`;
    const hqObject = `videos/${videoId}/hq-faststart.mp4`;

    const sdUrl = await uploadFile(bucket, sdObject, sdPath);
    const hqUrl = await uploadFile(bucket, hqObject, hqPath);

    // Update DB
    await query('UPDATE videos SET video_url = $1, video_url_sd = $2, status = $3, updated_at = NOW() WHERE id = $4', [hqUrl, sdUrl, 'published', videoId]);

    console.info('Postprocess complete for', videoId);
  } catch (err) {
    console.error('Postprocess failed', err);
    try { await query('UPDATE videos SET status = $1 WHERE id = $2', ['processing_failed', videoId]); } catch (e) {}
    process.exit(1);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
