#!/usr/bin/env node
// Copy dist/index.html -> dist/200.html for Render static site SPA fallback
import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexFile = path.join(distDir, 'index.html');
const fallbackFile = path.join(distDir, '200.html');

try {
  if (!fs.existsSync(indexFile)) {
    console.error('postbuild: dist/index.html not found. Run `vite build` first.');
    process.exit(1);
  }
  fs.copyFileSync(indexFile, fallbackFile);
  console.log('postbuild: created dist/200.html');
} catch (e) {
  console.error('postbuild error:', e);
  process.exit(1);
}
