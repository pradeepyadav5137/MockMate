const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();

// ── Environment validation (must run before any service initialization) ──
const { validateEnvironment } = require('./config/envValidator');
validateEnvironment();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const passport = require('passport');

const app = express();

const { initTable: initDynamoDBTable } = require('./config/dynamodb');

initDynamoDBTable().catch((err) => console.warn('DynamoDB init warning:', err.message));

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));

// ── Raw body capture for Razorpay webhook signature verification ────────
// SECURITY: The webhook route needs the exact raw body buffer for HMAC comparison.
// We capture it on ALL requests but only the webhook handler uses it.
app.use(express.json({ 
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/storage', require('./routes/storage'));
// Serve only resumes as static (they use a public URL pattern from uploadResume)
app.use('/api/storage/resumes', express.static(path.join(__dirname, 'storage', 'resumes')));
// NOTE: recordings/ and feedback-reports/ are NOT served statically — they go through authenticated endpoints

// ── Rate limiting ───────────────────────────────────────────────────────
// NOTE: In-memory rate limiting is NOT distributed-production-safe.
// For multi-instance production, replace with DynamoDB-backed or Redis-backed limiter.
const {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  paymentOrderLimiter,
  paymentVerifyLimiter,
  interviewCreateLimiter,
  guestSupportLimiter,
} = require('./middleware/rateLimiter');

// Apply rate limiting to sensitive routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/auth/resend-verification', resendVerificationLimiter);
app.use('/api/payment/create-order', paymentOrderLimiter);
app.use('/api/payment/verify', paymentVerifyLimiter);
app.use('/api/interview/create', interviewCreateLimiter);
app.use('/api/support/guest', guestSupportLimiter);

// ── Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/livekit', require('./routes/livekit'));
app.use('/api/support', require('./routes/ticket'));
app.use('/api/user-feedback', require('./routes/userFeedback'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/tts', require('./routes/tts'));

// ── SECURITY: /api/make-admin route has been REMOVED ────────────────────
// Admin promotion is now done exclusively via the CLI: node scripts/makeAdmin.js <email>

// ── Cron Jobs ───────────────────────────────────────────────────────────
require('./services/recordingCleanup').startCleanupCron();

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'MockMate API is running', timestamp: new Date() }));

app.use((_req, res) => res.status(404).json({ success: false, message: `Route ${_req.originalUrl} not found.` }));
app.use((err, _req, res, _next) => {
  console.error(err.stack || err);
  res.status(500).json({ success: false, message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`));

// ── Graceful shutdown ───────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('HTTP server close error:', err.message);
      process.exit(1);
    }
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Force shutting down after 10s timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
process.on('uncaughtException', (err) => console.error('Uncaught:', err));

module.exports = app;
module.exports.server = server;
