import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';

import sessions from './routes/sessions.js';
import interview from './routes/interview.js';
import { setupRealtimeProxy } from './realtimeProxy.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
