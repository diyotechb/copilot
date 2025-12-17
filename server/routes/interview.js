import express from 'express';
const router = express.Router();

// Minimal placeholder interview endpoints.
// Expand these to hook into your DB/store as needed.

router.get('/questions', (req, res) => {
  // Return an empty list by default (your frontend guard checks for questions).
  res.json([]);
});

// Example endpoint to persist interview transcripts (optional)
router.post('/transcripts', (req, res) => {
  // In dev this just echoes back
  res.json({ success: true, received: req.body });
});

export default router;
