import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { query, closePool } from './lib/database.js'; // Initialize database connection and provide close helper
import albumsRouter from './routes/albums.js';
import videosRouter from './routes/videos.js';
import purchasesRouter from './routes/purchases.js';
import paystackRouter, { paystackWebhookHandler } from './routes/paystack.js';
import uploadsRouter from './routes/uploads.js';
import mediaRouter from './routes/media.js';
import authRouter from './routes/auth.js';
import creatorsRouter from './routes/creators.js';
import songsRouter from './routes/songs.js';
import withdrawalsRouter from './routes/withdrawals.js';
import leaderboardRouter from './routes/leaderboard.js';
import supportRouter, { listTicketsHandler } from './routes/support.js';
import adminEarningsRouter from './routes/adminEarnings.js';
import promotionsRouter from './routes/promotions.js';
import promotionsAdminRouter from './routes/promotionsAdmin.js';

dotenv.config();

// Validate critical environment variables for production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PAYSTACK_SECRET_KEY'
  ];
  
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for upload endpoints to allow large file uploads
  skip: (req) => req.path.startsWith('/api/uploads/')
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  skipSuccessfulRequests: true,
});

app.use(limiter);

// Allow frontend origin(s) for CORS
const primaryFrontend = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
const allowedOrigins = new Set([
  primaryFrontend,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Primary Render frontend host
  'https://cedistream.onrender.com',
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow tools/curl
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
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
// Promotions public endpoint (read-only)
app.use('/api/promotions', promotionsRouter);
// Admin CRUD for promotions mounted under /api/admin/promotions
app.use('/api/admin/promotions', promotionsAdminRouter);

app.use((err, req, res, next) => {
  console.error(err);
  
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

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
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
          // derive bucket and path similar to delete handler
          const bucket = process.env.SUPABASE_BUCKET_PROMOTIONS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
          const marker = `/storage/v1/object/public/${bucket}/`;
          let path = null;
          const idx = p.image.indexOf(marker);
          if (idx !== -1) path = p.image.slice(idx + marker.length);
          else {
            const alt = `/${bucket}/`;
            const idx2 = p.image.indexOf(alt);
            if (idx2 !== -1) path = p.image.slice(idx2 + alt.length);
          }
          if (path) {
            try {
              const useBackblaze = process.env.BACKBLAZE_ACCOUNT_ID && process.env.BACKBLAZE_APPLICATION_KEY && (process.env.BACKBLAZE_BUCKET_NAME || process.env.B2_BUCKET_NAME);
              if (useBackblaze) {
                const { createBackblazeClient } = await import('./lib/backblaze.js');
                const b2 = createBackblazeClient();
                await b2.from(bucket).remove([path]);
              } else {
                // lazy import supabase to avoid startup dependency
                const { supabase } = await import('./lib/supabase.js');
                if (supabase) await supabase.storage.from(bucket).remove([path]);
              }
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
