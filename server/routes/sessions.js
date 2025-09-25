import express from 'express';
import db from '../models/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Create a new session for a user
router.post('/', (req, res) => {
  const { userId, startTime } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  db.run(
    'INSERT INTO sessions (userId, startTime) VALUES (?, ?)',
    [userId, startTime],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Get all sessions for a user
router.get('/user/:userId', (req, res) => {
  db.all('SELECT * FROM sessions WHERE userId = ?', [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get all sessions (admin or for listing)
router.get('/', requireAdmin, (req, res) => {
  db.all('SELECT * FROM sessions', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// Update lastActive for a session
router.put('/:sessionId/last-active', (req, res) => {
  const { lastActive } = req.body;
  db.run(
    'UPDATE sessions SET lastActive = ? WHERE id = ?',
    [lastActive, req.params.sessionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// End a session (set endTime)
router.put('/:sessionId/end', (req, res) => {
  const { endTime } = req.body;
  db.run(
    'UPDATE sessions SET endTime = ? WHERE id = ?',
    [endTime, req.params.sessionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

export default router;