import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { closePool } from './lib/database.js'; // Initialize database connection and provide close helper
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

dotenv.config();

const app = express();
const BASE_PORT = Number(process.env.PORT) || 5000;

app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000' }));
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

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
