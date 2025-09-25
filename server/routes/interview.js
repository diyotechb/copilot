import express from 'express';
import db from '../models/db.js';
const router = express.Router();


// Get all interviews for a session
router.get('/', (req, res) => {
  db.all('SELECT * FROM interviews', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


router.post('/bulk', (req, res) => {
  const { interviews } = req.body;
  if (!Array.isArray(interviews)) {
    return res.status(400).json({ error: 'interviews must be an array' });
  }

  const stmt = db.prepare(
    `INSERT INTO interviews (sessionId, question, answer, transcript)
     VALUES (?, ?, ?, ?)`
  );

  let errorOccurred = false;
  let errorDetails = [];

  db.serialize(() => {
    interviews.forEach(i => {
      stmt.run([i.sessionId, i.question, i.answer, JSON.stringify(i.transcript)], function (err) {
        if (err) {
          errorOccurred = true;
          errorDetails.push({ error: err.message, interview: i });
          console.error('Bulk insert error:', err.message, i);
        }
      });
    });
    stmt.finalize((err) => {
      if (errorOccurred || err) {
        return res.status(500).json({
          error: err ? err.message : 'One or more inserts failed.',
          details: errorDetails
        });
      }
      res.json({ success: true, count: interviews.length });
    });
  });
});

router.get('/session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  db.all(
    'SELECT * FROM interviews WHERE sessionId = ?',
    [sessionId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching interviews:', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

export default router;