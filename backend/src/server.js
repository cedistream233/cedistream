import express from 'express';
import cors from 'cors';
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

dotenv.config();

const app = express();
const BASE_PORT = Number(process.env.PORT) || 5000;

// Allow frontend origin(s) for CORS
const primaryFrontend = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
const allowedOrigins = new Set([
  primaryFrontend,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
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
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Background job: mark pending purchases older than N minutes as failed
function scheduleAutoFailPendingPurchases() {
  const disabled = String(process.env.DISABLE_PENDING_AUTOFAIL || '').toLowerCase() === 'true';
  if (disabled) {
    console.log('⏭️  Pending auto-fail job disabled via DISABLE_PENDING_AUTOFAIL=true');
    return;
  }
  const windowMinutes = Number(process.env.PENDING_FAIL_MINUTES || 30);
  const pollMinutes = Number(process.env.PENDING_FAIL_POLL_MINUTES || 10);
  const pollMs = Math.max(1, pollMinutes) * 60 * 1000;

  const runOnce = async () => {
    try {
      const res = await query(
        `UPDATE purchases
         SET payment_status = 'failed', updated_at = NOW()
         WHERE payment_status = 'pending' AND created_at < NOW() - INTERVAL '${windowMinutes} minutes'
         RETURNING id`
      );
      if (res.rowCount) {
        console.log(`🟡 Auto-failed ${res.rowCount} stale pending purchase(s)`);
      }
    } catch (e) {
      console.error('Auto-fail pending purchases job error:', e);
    }
  };

  // Kick off on startup and then on interval
  runOnce();
  setInterval(runOnce, pollMs);
}

// Start server with graceful fallback if port is in use
function startServer(port, attemptsLeft = 10) {
  const server = app.listen(port, () => {
    console.log(`✅ Server listening on Port:${port}`);
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

// Graceful shutdown
const shutdown = async (signal) => {
  try {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    await closePool();
    process.exit(0);
  } catch (e) {
    console.error('Error during shutdown:', e);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
