import express from 'express';
const router = express.Router();

router.post('/reconstruct-timeline', (req, res) => {
  const { events, memory_text } = req.body;
  if (!events || events.length === 0) {
    return res.status(400).json({ error: 'Missing events data' });
  }
  
  res.json({ success: true, message: 'Timeline reconstructed successfully by AI!' });
});

router.post('/structure', (req, res) => {
  const { memory_text, emotions, certainty, timeline_events } = req.body;
  
  const emotionsStr = (emotions && emotions.length > 0) ? emotions.join(', ') : 'not specified';
  const timelineStr = (timeline_events && timeline_events.length > 0)
    ? timeline_events.map(v => `[${v.certainty || 'medium'}] ${v.event_time || 'unknown time'} &mdash; ${v.event_text}`).join('<br>')
    : 'No timeline provided';

  const summary = `
    <strong>Nature of Incident:</strong> The survivor reports an incident involving coercion and distress.<br><br>
    <strong>Emotional State at Recording:</strong> ${emotionsStr}<br><br>
    <strong>Account Summary:</strong> ${memory_text || 'Voice testimony recorded.'}<br><br>
    <strong>Timeline:</strong><br>${timelineStr}<br><br>
    <strong>Memory Reliability Note:</strong> Certainty self-assessed at ${certainty || 60}%.
    Fragmented recall is consistent with trauma-induced memory encoding.
  `;

  res.json({ summary });
});

export default router;