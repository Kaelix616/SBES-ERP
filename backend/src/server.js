// sbes.erp – Backend API Server
// Shahbabu Educational Society – Attendance ERP Portal | Developed by Abdul Wahab
// Express + Firebase Admin SDK

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { initFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');

// ── Initialize Firebase Admin SDK ───────────────────────────────────────────
initFirebase();

// ── Express app ─────────────────────────────────────────────────────────────
const app = express();

// ── Security & Utility middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait and try again.' },
});
app.use('/api/', limiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/students', require('./routes/students'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/reports', require('./routes/reports'));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sbes.erp Backend API',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════════╗`);
  console.log(`  ║  sbes.erp Backend API                            ║`);
  console.log(`  ║  Shahbabu Educational Society                    ║`);
  console.log(`  ║  Developed by Abdul Wahab                        ║`);
  console.log(`  ╠══════════════════════════════════════════════════╣`);
  console.log(`  ║  Server running on http://localhost:${PORT}          ║`);
  console.log(`  ║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(35)}║`);
  console.log(`  ╚══════════════════════════════════════════════════╝\n`);
});

module.exports = app;
