/**
 * Rate limiting middleware.
 * Uses in-memory store — sufficient for single-instance dev.
 * NOTE: For multi-instance production, replace with DynamoDB-backed or Redis-backed limiter.
 */
const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Generic message to reduce account enumeration
    message: { success: false, message: message || 'Too many requests. Please try again later.' },
  });

// ── Auth endpoints ──────────────────────────────────────────────────────
const loginLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  10,             // 10 attempts
  'Too many login attempts. Please try again in 15 minutes.'
);

const registerLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  5,              // 5 accounts per hour per IP
  'Too many registration attempts. Please try again later.'
);

const forgotPasswordLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  3,              // 3 attempts
  'Too many password reset requests. Please try again later.'
);

const resendVerificationLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  3,              // 3 attempts
  'Too many verification requests. Please try again later.'
);

const resetPasswordLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  5,              // 5 attempts
  'Too many password reset attempts. Please try again later.'
);

// ── Payment endpoints ───────────────────────────────────────────────────
const paymentOrderLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  10,             // 10 orders
  'Too many payment requests. Please try again later.'
);

const paymentVerifyLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  15,             // 15 verification attempts
  'Too many verification attempts. Please try again later.'
);

// ── Interview creation ──────────────────────────────────────────────────
const interviewCreateLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  10,             // 10 interviews
  'Too many interview requests. Please try again later.'
);

// ── Support ─────────────────────────────────────────────────────────────
const guestSupportLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  5,              // 5 guest tickets
  'Too many submissions. Please try again later.'
);

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
  paymentOrderLimiter,
  paymentVerifyLimiter,
  interviewCreateLimiter,
  guestSupportLimiter,
};
