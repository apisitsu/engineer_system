require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { errorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes     = require('./routes/auth');
const requestRoutes  = require('./routes/requests');
const workflowRoutes = require('./routes/workflow');
const adminRoutes    = require('./routes/admin');
const masterRoutes   = require('./routes/master');
const configRoutes   = require('./routes/config');
const uploadRoutes   = require('./routes/upload');
const sdsRoutes           = require('./routes/sds');
const toolingSelectRoutes = require('./routes/tooling_select');

const app = express();
const PORT = process.env.PORT || 2005;

/* ── Middleware ─────────────────────────────────────────── */
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Static: uploaded files ─────────────────────────────── */
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

/* ── API Routes ─────────────────────────────────────────── */

// Auth (shared — rodpc.m_user)
app.use('/api/auth', authRoutes);

// Drawing Request (engreq database)
app.use('/api/requests',  requestRoutes);
app.use('/api/workflow',  workflowRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/master',    masterRoutes);
app.use('/api/config',    configRoutes);
app.use('/api/upload',    uploadRoutes);

// Setup Data Sheet (production_db)
app.use('/api/sds', sdsRoutes);

// Tooling Select (tooling_select)
app.use('/api/tooling-select', toolingSelectRoutes);

/* ── Health check ───────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'MTC Engineer API', port: PORT });
});

/* ── Global error handler ───────────────────────────────── */
app.use(errorHandler);

/* ── Start ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`MTC Engineer API running on port ${PORT}`);
  console.log(`  Drawing Request : /api/requests, /api/workflow`);
  console.log(`  Setup Data Sheet: /api/sds`);
  console.log(`  Tooling Select  : /api/tooling-select`);
});
