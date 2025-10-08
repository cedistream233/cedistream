import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import albumsRouter from './routes/albums.js';
import videosRouter from './routes/videos.js';
import purchasesRouter from './routes/purchases.js';
import paystackRouter from './routes/paystack.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/albums', albumsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/paystack', paystackRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on Port:${PORT}`);
});
