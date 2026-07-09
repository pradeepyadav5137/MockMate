const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

/**
 * Standard JWT authentication middleware.
 * Requires valid JWT, loads user from DynamoDB, rejects disabled users.
 * SECURITY: Never uses a fallback secret.
 */
const protect = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[Auth] JWT_SECRET is not configured');
      return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }

    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    // Reject banned/disabled users
    if (user.status === 'disabled' || user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Account is disabled.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

/**
 * Require email verification for sensitive operations.
 */
const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email to continue.',
    });
  }
  next();
};

/**
 * Require admin role. Must be used AFTER protect middleware.
 * Returns 403 for authenticated non-admin users.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }
  next();
};

/**
 * Internal service authentication for agent→backend communication.
 * Uses AGENT_INTERNAL_SECRET (separate from JWT_SECRET).
 * Uses timing-safe comparison to prevent timing attacks.
 */
const requireInternalAuth = (req, res, next) => {
  const secret = process.env.AGENT_INTERNAL_SECRET;
  if (!secret) {
    console.error('[Auth] AGENT_INTERNAL_SECRET is not configured');
    return res.status(500).json({ success: false, message: 'Internal auth not configured.' });
  }

  const provided = req.headers['x-internal-key'];
  if (!provided) {
    return res.status(401).json({ success: false, message: 'Internal authentication required.' });
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(secret, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ success: false, message: 'Invalid internal credentials.' });
    }
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid internal credentials.' });
  }

  req.isInternalRequest = true;
  next();
};

/**
 * Middleware that accepts either internal auth OR standard JWT auth.
 * Used for endpoints that both the agent and authenticated users can call.
 */
const protectOrInternal = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  const internalSecret = process.env.AGENT_INTERNAL_SECRET;

  if (internalKey && internalSecret) {
    try {
      const a = Buffer.from(internalSecret, 'utf8');
      const b = Buffer.from(internalKey, 'utf8');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        req.isInternalRequest = true;
        return next();
      }
    } catch {
      // Fall through to JWT auth
    }
  }

  // Fall through to standard JWT auth
  return protect(req, res, next);
};

module.exports = { protect, requireVerified, requireAdmin, requireInternalAuth, protectOrInternal };
