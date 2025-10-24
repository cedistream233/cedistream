// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from Vite's dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint for uptime monitors and platform health checks
app.get('/health', (req, res) => {
  // lightweight response used by uptime monitors (UptimeRobot, etc.)
  res.status(200).send('OK');
});

// Fallback to index.html for client-side routing (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server listening on port ${PORT}`);
});
