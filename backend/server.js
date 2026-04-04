import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import testimonyRoutes from './routes/testimony.js';
import aiRoutes from './routes/ai.js';
import exportRoutes from './routes/export.js';

dotenv.config();

const app = express();

// ── SECURITY ──
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── RATE LIMITING ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit reached. Please wait a moment.' },
});
app.use('/api/', limiter);
app.use('/api/ai/', aiLimiter);

// ── BODY PARSING ──
app.use(express.json({ limit: '2mb' }));

// ── DB ──
connectDB();
app.get('/', (req, res) => {
  res.send('Safevoice API is running');
});

// ── ROUTES ──
app.use('/api/auth',      authRoutes);
app.use('/api/testimony', testimonyRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/export',    exportRoutes);

// ── HEALTH ──
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── GLOBAL ERROR HANDLER ──
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SafeVoice API running on port ${PORT}`));
