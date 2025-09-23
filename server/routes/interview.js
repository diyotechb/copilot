import express from 'express';
import db from '../models/db.js';
const router = express.Router();

// Create a new interview summary
router.post('/', (req, res) => {
  const { sessionId, question, answer, transcript } = req.body;
  db.run(
    `INSERT INTO interviews (sessionId, question, answer, transcript)
     VALUES (?, ?, ?, ?)`,
    [sessionId, question, answer, transcript],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Get all interviews for a session
router.get('/session/:sessionId', (req, res) => {
  db.all('SELECT * FROM interviews WHERE sessionId = ?', [req.params.sessionId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/bulk', (req, res) => {
  const { interviews } = req.body;
  if (!Array.isArray(interviews)) return res.status(400).json({ error: 'interviews must be an array' });

  const stmt = db.prepare(
    `INSERT INTO interviews (sessionId, question, answer, transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  db.serialize(() => {
    interviews.forEach(i => {
      stmt.run([i.sessionId, i.question, i.answer, i.transcript]);
    });
    stmt.finalize();
    res.json({ success: true, count: interviews.length });
  });
});

export default router;