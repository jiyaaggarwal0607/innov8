import express from 'express';
import { pool } from '../config/db.js';
import { encrypt } from '../utils/crypto.js';

const router = express.Router();

router.get('/',(req,res) => { 
    res.send('Testimony route working');
});

router.post('/', async (req, res) => {
  try {
    const {
      caseRef,
      storyText,
      emotions,
      certainty,
      timeline,
      offenderDesc,
      summary
    } = req.body;

    if (!caseRef) {
      return res.status(400).json({ error: 'Case reference is required' });
    }

    // Encrypt sensitive information AT REST
    const encryptedStoryText = encrypt(storyText || '');
    const encryptedTimeline = encrypt(JSON.stringify(timeline || {}));
    const encryptedSummary = encrypt(summary || '');
    const encryptedOffenderDesc = encrypt(offenderDesc || '');
    const encryptedEmotions = encrypt(JSON.stringify(emotions || []));

    const [result] = await pool.execute(
      `INSERT INTO testimonies (case_ref, story_text, emotions, certainty, timeline, summary_html, offender_desc)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        caseRef,
        encryptedStoryText,
        encryptedEmotions,
        certainty || 60,
        encryptedTimeline,
        encryptedSummary,
        encryptedOffenderDesc
      ]
    );

    res.status(201).json({ success: true, id: result.insertId, caseRef });
  } catch (error) {
    console.error('Error saving testimony:', error);
    res.status(500).json({ error: 'Internal server error while saving testimony' });
  }
});

export default router;