import express, { json } from 'express';
const app = express();
const PORT = 3001;
import cors from 'cors';

app.use(cors());
app.use(json());

import sessions from './routes/sessions.js';
import interview from './routes/interview.js';
app.use('/api/session', sessions);
app.use('/api/interview', interview);

// Health check endpoint

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});