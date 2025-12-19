import dotenv from 'dotenv';
dotenv.config();

// Runtime guard: ensure required production environment variables are present
const requiredEnvVars = ['ASSEMBLYAI_API_KEY'];
if (process.env.NODE_ENV === 'production') {
  const missing = requiredEnvVars.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required environment variables for production: ${missing.join(', ')}`);
    console.error('Please set these in your environment or a secrets manager. Exiting.');
    process.exit(1);
  }
} else {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.warn('Warning: ASSEMBLYAI_API_KEY is not set. Realtime proxy will not function without it.');
  }
}

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import sessions from './routes/sessions.js';
import interview from './routes/interview.js';
import { setupRealtimeProxy } from './realtimeProxy.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// If running in production, serve the frontend from the built `dist/` folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// Application routes
app.use('/api/session', sessions);
app.use('/api/interview', interview);

// Health check endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err?.message || String(err) });
});

// Create HTTP server & attach WebSocket proxy
const server = http.createServer(app);

// Attach the realtime proxy (from server/realtimeProxy.js)
setupRealtimeProxy(server);

// Start listening
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
