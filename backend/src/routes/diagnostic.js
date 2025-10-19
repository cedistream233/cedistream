import express from 'express';
import { createBackblazeClient } from '../lib/backblaze.js';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Diagnostic endpoint to test Backblaze auth from running server
router.get('/test-b2-auth', async (req, res) => {
  try {
    console.log('[Diagnostic] Testing Backblaze auth...');
    console.log('[Diagnostic] BACKBLAZE_ACCOUNT_ID:', process.env.BACKBLAZE_ACCOUNT_ID);
    console.log('[Diagnostic] BACKBLAZE_APPLICATION_KEY length:', process.env.BACKBLAZE_APPLICATION_KEY?.length);
    
    const b2 = createBackblazeClient();
    
    // Try a simple operation that requires auth
    const result = await b2.from('cedistream-profiles').getPublicUrl('test');
    
    res.json({
      success: true,
      message: 'Backblaze authorization succeeded',
      accountId: process.env.BACKBLAZE_ACCOUNT_ID?.slice(0, 8) + '...',
      appKeyLength: process.env.BACKBLAZE_APPLICATION_KEY?.length,
      testResult: result
    });
  } catch (err) {
    console.error('[Diagnostic] Backblaze test failed:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      accountId: process.env.BACKBLAZE_ACCOUNT_ID?.slice(0, 8) + '...',
      appKeyLength: process.env.BACKBLAZE_APPLICATION_KEY?.length
    });
  }
});

// Raw authorize via HTTP (helps compare SDK vs raw request)
router.get('/b2-authorize-raw', async (req, res) => {
  try {
    const accountId = process.env.BACKBLAZE_ACCOUNT_ID || '';
    const appKey = process.env.BACKBLAZE_APPLICATION_KEY || '';
    if (!accountId || !appKey) return res.status(400).json({ error: 'Missing accountId/appKey' });
    const basic = Buffer.from(`${accountId}:${appKey}`).toString('base64');
    const url = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account';
    const r = await axios.get(url, { headers: { Authorization: `Basic ${basic}` }, timeout: 10000 });
    res.json({ ok: true, status: r.status, data: r.data });
  } catch (err) {
    res.status(500).json({ ok: false, status: err?.response?.status, data: err?.response?.data || err.message });
  }
});

// Return the masked Basic Authorization header the server will send when authorizing with B2
router.get('/auth-header', (req, res) => {
  try {
    const accountId = process.env.BACKBLAZE_ACCOUNT_ID || '';
    const appKey = process.env.BACKBLAZE_APPLICATION_KEY || '';
    const basic = Buffer.from(`${accountId}:${appKey}`).toString('base64');
    const mask = (s) => s ? `${s.slice(0,6)}...${s.slice(-6)}` : '(missing)';
    res.json({
      header: `Basic ${mask(basic)}`,
      accountIdMasked: accountId ? accountId.slice(0, 8) + '...' : '(missing)',
      appKeyLength: appKey.length || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Key-check endpoint: safe diagnostics to detect quoting/whitespace issues
router.get('/key-check', (req, res) => {
  try {
    const raw = process.env.BACKBLAZE_APPLICATION_KEY ?? '';
    const trimmed = raw.trim();
    const hasLeadingQuote = raw.startsWith('"') || raw.startsWith("'");
    const hasTrailingQuote = raw.endsWith('"') || raw.endsWith("'");
    const hasCR = raw.includes('\r');
    const hasLF = raw.includes('\n');

    const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
    const mask = (s) => s ? `${s.slice(0,8)}...${s.slice(-8)}` : '(empty)';

    res.json({
      ok: true,
      rawLength: raw.length,
      trimmedLength: trimmed.length,
      hasLeadingQuote,
      hasTrailingQuote,
      hasCR,
      hasLF,
      rawSha256: mask(hash(raw)),
      trimmedSha256: mask(hash(trimmed)),
      note: 'Hashes are masked (first/last 8 chars) to avoid leaking full secrets. If raw vs trimmed hashes differ, the env value contains extra characters or quotes.'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
