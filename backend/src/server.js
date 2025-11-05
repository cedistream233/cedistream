import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from backend/.env reliably, regardless of working directory, and override any pre-set vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: true });

// Dynamic imports for modules that may read environment variables at import-time.
// We import them after dotenv.config to ensure env is loaded before any module-level reads.
let query, closePool;
let albumsRouter, videosRouter, purchasesRouter, paystackRouter, paystackWebhookHandler;
let uploadsRouter, mediaRouter, authRouter, creatorsRouter, songsRouter, withdrawalsRouter;
let leaderboardRouter, supportRouter, listTicketsHandler, adminEarningsRouter;
let promotionsRouter, promotionsAdminRouter;
let likesRouter, commentsRouter, commentLikesRouter;

// Top-level await is supported in Node >= 14; load modules now that env is configured
({ query, closePool } = await import('./lib/database.js'));
({ default: albumsRouter } = await import('./routes/albums.js'));
({ default: videosRouter } = await import('./routes/videos.js'));
({ default: purchasesRouter } = await import('./routes/purchases.js'));
({ default: uploadsRouter } = await import('./routes/uploads.js'));
({ default: mediaRouter } = await import('./routes/media.js'));
({ default: authRouter } = await import('./routes/auth.js'));
({ default: creatorsRouter } = await import('./routes/creators.js'));
({ default: songsRouter } = await import('./routes/songs.js'));
({ default: withdrawalsRouter } = await import('./routes/withdrawals.js'));
({ default: leaderboardRouter } = await import('./routes/leaderboard.js'));
({ default: adminEarningsRouter } = await import('./routes/adminEarnings.js'));
({ default: promotionsRouter } = await import('./routes/promotions.js'));
({ default: promotionsAdminRouter } = await import('./routes/promotionsAdmin.js'));
({ default: supportRouter, listTicketsHandler } = await import('./routes/support.js'));
({ default: paystackRouter, paystackWebhookHandler } = await import('./routes/paystack.js'));
({ default: commentLikesRouter } = await import('./routes/commentLikes.js'));
({ default: likesRouter } = await import('./routes/likes.js'));
({ default: commentsRouter } = await import('./routes/comments.js'));

// Only print masked Backblaze info when debugging to avoid noise in production
const B2_DEBUG = String(process.env.BACKBLAZE_DEBUG || '').toLowerCase() === 'true';
const mask = (s) => (s && s.length >= 8) ? `${s.slice(0,4)}...${s.slice(-4)} (len:${s.length})` : (s ? `(len:${s.length})` : 'missing');
if (B2_DEBUG) {
  console.info('Backblaze keyId (masked):', mask(process.env.BACKBLAZE_ACCOUNT_ID));
  console.info('Backblaze appKey length:', process.env.BACKBLAZE_APPLICATION_KEY ? process.env.BACKBLAZE_APPLICATION_KEY.length : 0);
}

// Validate critical environment variables for production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PAYSTACK_SECRET_KEY'
  ];
  
  // Storage: require Backblaze B2 for storage in production
  // BACKBLAZE_BUCKET_NAME is optional; the app prefers per-feature bucket env vars
  const hasBackblaze = process.env.BACKBLAZE_ACCOUNT_ID && process.env.BACKBLAZE_APPLICATION_KEY;

  if (!hasBackblaze) {
    console.error('❌ CRITICAL: No storage configured. Set Backblaze environment variables: BACKBLAZE_ACCOUNT_ID, BACKBLAZE_APPLICATION_KEY');
    process.exit(1);
  }

  console.info('✅ Using Backblaze B2 for storage');
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables for production:', missing.join(', '));
    process.exit(1);
  }
}

const app = express();
const BASE_PORT = Number(process.env.PORT) || 5000;

// Behind Render's proxy: trust first proxy so req.ip and rate limiters work correctly
// https://render.com/docs/configure-ssl#using-x-forwarded-proto
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));
// Allow frontend origin(s) for CORS
const primaryFrontend = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
const allowedOrigins = new Set([
  primaryFrontend.replace(/\/+$/, ''), // normalize trailing slash
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://cedistream.onrender.com',
  'https://cedistreambackend.onrender.com',
]);

const DEBUG_CORS = String(process.env.DEBUG_CORS || '').toLowerCase() === 'true';

const isAllowedOrigin = (origin) => {
  if (!origin) return true;              // curl/tools (no Origin)
  const o = origin.replace(/\/+$/, '');  // normalize
  if (allowedOrigins.has(o)) return true;

  // Tolerate opaque/special origins that Chrome may use for blob/workers/webviews
  if (o === 'null' || o.startsWith('blob:') || o.startsWith('video-') || o.startsWith('capacitor:')) {
    return true;
  }
  return false;
};

// Register CORS BEFORE anything else
app.use(cors({
  origin: (origin, cb) => {
    const ok = isAllowedOrigin(origin || '');
    if (DEBUG_CORS) console.log('[CORS] origin:', origin, '->', ok ? 'allowed' : 'blocked');
    cb(null, ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Always answer OPTIONS with proper headers (204) so preflight succeeds
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || primaryFrontend || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With'
    );
    return res.sendStatus(204);
  }
  return next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for upload endpoints to allow large file uploads
  skip: (req) => req.path.startsWith('/api/uploads/'),
  // Ensure 429 responses include CORS headers so browsers don't block them
  handler: (req, res /*, next */) => {
    // prefer request origin when present, otherwise fall back to allowed primaryFrontend or wildcard
    const origin = req.headers.origin || primaryFrontend || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Also mirror standard CORS preflight headers that clients may expect
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  skipSuccessfulRequests: true,
});

app.use(limiter);
// Use JSON by default; Paystack webhook uses raw body at the route level
// Raw body required for Paystack signature verification on webhook
app.post('/api/paystack/webhook', express.raw({ type: '*/*' }), paystackWebhookHandler);
// Increase body size limit to handle large file uploads (unlimited for videos)
app.use(express.json({ limit: '50mb' })); // For JSON payloads with base64 encoded data
app.use(express.urlencoded({ limit: '50mb', extended: true })); // For form data

// Shallow health check (no DB) for platform probes like Render/UptimeRobot
const shallowHealthHandler = (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
};

// Deep health check (includes DB) for internal diagnostics
const deepHealthHandler = async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      ok: true,
      time: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      ok: false,
      time: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
};

// Deep health for manual checks
app.get('/api/health', deepHealthHandler);
// Shallow health for platform probes
app.get('/health', shallowHealthHandler);
app.get('/healthz', shallowHealthHandler);

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/songs', songsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/paystack', paystackRouter);
app.use('/api/creators', creatorsRouter);
app.use('/api/withdrawals', withdrawalsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/support', supportRouter);
app.get('/api/support-tickets', listTicketsHandler); // alias for admin listing
app.use('/api/admin', adminEarningsRouter);
app.use('/api/promotions', promotionsRouter);
// Admin CRUD for promotions mounted under /api/admin/promotions
app.use('/api/admin/promotions', promotionsAdminRouter);
// Likes and comments for all content types
app.use('/api/likes', likesRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/comment-likes', commentLikesRouter);

// serve frontend static files (adjust if your build dir differs)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// IMPORTANT: place this after all API routes so client-side routes resolve to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      console.error('Error sending index.html for route', req.url, err);
      res.status(err.status || 500).end();
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  // Ensure CORS headers are present on error responses so browsers can read them
  try {
    const origin = req && req.headers && req.headers.origin ? req.headers.origin : primaryFrontend || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } catch (e) {
    // ignore header set errors
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: err.message,
      stack: err.stack
    });
  }
});

// Handle unmatched API routes and non-GET requests with a JSON 404.
// Note: GET requests for client-side routes are handled by the SPA catch-all
// (app.get('*') above) which serves index.html. This middleware intentionally
// only returns 404s for API namespace or for non-GET methods.
app.use((req, res, next) => {
  // If it's an API route, always return JSON 404
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    // Ensure CORS headers on API 404s too
    try {
      const origin = req && req.headers && req.headers.origin ? req.headers.origin : primaryFrontend || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } catch (e) {}
    return res.status(404).json({ error: 'API route not found' });
  }

  // Non-GET requests to non-API routes should get a JSON 404 as well
  if (req.method !== 'GET') {
    try {
      const origin = req && req.headers && req.headers.origin ? req.headers.origin : primaryFrontend || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } catch (e) {}
    return res.status(404).json({ error: 'Route not found' });
  }

  // For GETs (non-API), let the SPA catch-all (which is earlier) handle them.
  // If the SPA catch-all didn't match (very unlikely), fall through to next.
  return next();
});

// Background job: mark pending purchases older than N minutes as failed
function scheduleAutoFailPendingPurchases() {
  const disabled = String(process.env.DISABLE_PENDING_AUTOFAIL || '').toLowerCase() === 'true';
  if (disabled) {
    console.info('⏭️  Pending auto-fail job disabled via DISABLE_PENDING_AUTOFAIL=true');
    return;
  }
  const windowMinutes = Number(process.env.PENDING_FAIL_MINUTES || 30);
  const pollMinutes = Number(process.env.PENDING_FAIL_POLL_MINUTES || 10);
  const initialDelayMs = Number(process.env.PENDING_FAIL_INITIAL_DELAY_MS || 15000);
  const pollMs = Math.max(1, pollMinutes) * 60 * 1000;

  const runOnce = async () => {
    const res = await query(
      `UPDATE purchases
         SET payment_status = 'failed', updated_at = NOW()
         WHERE payment_status = 'pending' AND created_at < NOW() - INTERVAL '${windowMinutes} minutes'
         RETURNING id`
    );
    if (res && res.rowCount) {
      console.info(`🟡 Auto-failed ${res.rowCount} stale pending purchase(s)`);
    }
  };

  // schedule safely via runJobSafely wrapper defined below
  setTimeout(() => runJobSafely(runOnce, 'Auto-fail pending purchases job', { initial: true }), Math.max(0, initialDelayMs));
  setInterval(() => runJobSafely(runOnce, 'Auto-fail pending purchases job'), pollMs);
}

// Start server with graceful fallback if port is in use
function startServer(port, attemptsLeft = 10) {
  const server = app.listen(port, () => {
    console.info(`✅ Server listening on Port:${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const next = port + 1;
      console.warn(`⚠️  Port ${port} in use. Retrying on ${next}... (${attemptsLeft - 1} attempts left)`);
      // Try the next port shortly
      setTimeout(() => startServer(next, attemptsLeft - 1), 250);
    } else {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
  });
}

startServer(BASE_PORT);

// Start background cleanup job
scheduleAutoFailPendingPurchases();

// Background job: cleanup expired promotions and their storage objects
function scheduleExpiredPromotionsCleanup() {
  const disabled = String(process.env.DISABLE_PROMO_CLEANUP || '').toLowerCase() === 'true';
  if (disabled) {
    console.info('⏭️  Promotions cleanup job disabled via DISABLE_PROMO_CLEANUP=true');
    return;
  }
  const pollMinutes = Number(process.env.PROMO_CLEANUP_POLL_MINUTES || 60); // default hourly
  const initialDelayMs = Number(process.env.PROMO_CLEANUP_INITIAL_DELAY_MS || 30000);
  const pollMs = Math.max(1, pollMinutes) * 60 * 1000;

  const runOnce = async () => {
    // Find expired promotions
    const res = await query(`SELECT id, image FROM promotions WHERE ends_at IS NOT NULL AND ends_at < NOW()`);
    if (!res || res.rowCount === 0) return;
    const rows = res.rows;
    for (const p of rows) {
      // Attempt to remove image from storage if available
      try {
        if (p.image) {
          // derive path from URL
          let path = null;
          const marker = `/storage/v1/object/public/`;
          const idx = p.image.indexOf(marker);
          if (idx !== -1) {
            const afterMarker = p.image.slice(idx + marker.length);
            const parts = afterMarker.split('/');
            if (parts.length > 1) path = parts.slice(1).join('/');
          } else {
            const alt = `/promotions/`;
            const idx2 = p.image.indexOf(alt);
            if (idx2 !== -1) path = p.image.slice(idx2 + 1);
          }
          if (path) {
            try {
              const { createBackblazeClient } = await import('./lib/backblaze.js');
              const b2 = createBackblazeClient();
              await b2.from('promotions').remove([path]);
            } catch (e) {
              console.warn('Failed to remove expired promotion image:', e.message || e);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to remove expired promotion image:', e.message || e);
      }
      // delete promotion row
      try { await query('DELETE FROM promotions WHERE id = $1', [p.id]); } catch (e) { console.warn('Failed to delete expired promotion row', e); }
    }
  console.info(`🧹 Cleaned up ${rows.length} expired promotion(s)`);
  };

  setTimeout(() => runJobSafely(runOnce, 'Expired promotions cleanup job', { initial: true }), Math.max(0, initialDelayMs));
  setInterval(() => runJobSafely(runOnce, 'Expired promotions cleanup job'), pollMs);
}

// Helper to run jobs safely: checks DB reachability, retries if transient, respects DISABLE_* flags
// Tracks last warning time per job to throttle repeated "DB unreachable" logs
const jobWarningLog = new Map();
const JOB_WARNING_THROTTLE_MS = 60000; // only log "DB unreachable" for same job once per minute

async function runJobSafely(fn, name = 'background job', opts = {}) {
  try {
    // Global disable switch: if DISABLE_JOBS=1 or specific disable flags set, skip
    if (process.env.DISABLE_JOBS === '1') {
      // Only log skip message once on startup (when opts.initial is true)
      if (opts.initial) console.info(`⏭️  ${name} skipped because DISABLE_JOBS=1`);
      return;
    }
    // Lightweight reachability check
    try {
      await query('SELECT 1');
    } catch (err) {
      const now = Date.now();
      const lastWarned = jobWarningLog.get(name) || 0;
      if ((now - lastWarned) > JOB_WARNING_THROTTLE_MS) {
        console.warn(`⏸️  ${name} skipped: DB unreachable (${err.code || err.message})`);
        jobWarningLog.set(name, now);
      }
      return;
    }

    // Run actual job
    await fn();
  } catch (err) {
    console.error(`❌ ${name} error:`, err);
  }
}

scheduleExpiredPromotionsCleanup();

// Graceful shutdown
const shutdown = async (signal) => {
  try {
  console.info(`\n${signal} received. Shutting down gracefully...`);
    await closePool();
    process.exit(0);
  } catch (e) {
    console.error('Error during shutdown:', e);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
