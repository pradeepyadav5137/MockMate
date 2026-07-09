/**
 * Centralized environment validation.
 * In production: fails fast for missing critical configuration.
 * In development: warns but allows startup with reduced functionality.
 */
const isProduction = process.env.NODE_ENV === 'production';

const errors = [];
const warnings = [];

function requireEnv(name, { required = true, productionOnly = false } = {}) {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    if (productionOnly && !isProduction) {
      warnings.push(`${name} is not set (optional in development)`);
      return undefined;
    }
    if (required) {
      if (isProduction) {
        errors.push(`FATAL: ${name} is required in production but not set`);
      } else {
        warnings.push(`${name} is not set (required in production)`);
      }
    }
    return undefined;
  }
  return val.trim();
}

// ── Core ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || '5000';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── JWT — NEVER use a fallback secret ───────────────────────────────────
const JWT_SECRET = requireEnv('JWT_SECRET');
if (JWT_SECRET && JWT_SECRET.length < 32 && isProduction) {
  errors.push('FATAL: JWT_SECRET must be at least 32 characters in production');
}
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// ── Separate internal service auth — NEVER reuse JWT_SECRET ─────────────
const AGENT_INTERNAL_SECRET = requireEnv('AGENT_INTERNAL_SECRET');
if (AGENT_INTERNAL_SECRET && JWT_SECRET && AGENT_INTERNAL_SECRET === JWT_SECRET) {
  errors.push('FATAL: AGENT_INTERNAL_SECRET must differ from JWT_SECRET');
}

// ── AWS / DynamoDB ──────────────────────────────────────────────────────
const AWS_REGION = requireEnv('AWS_REGION') || 'ap-south-1';
const AWS_ACCESS_KEY_ID = requireEnv('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = requireEnv('AWS_SECRET_ACCESS_KEY');

// ── Razorpay ────────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID = requireEnv('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = requireEnv('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = requireEnv('RAZORPAY_WEBHOOK_SECRET', { productionOnly: true });

// ── LiveKit ─────────────────────────────────────────────────────────────
const LIVEKIT_URL = requireEnv('LIVEKIT_URL');
const LIVEKIT_API_KEY = requireEnv('LIVEKIT_API_KEY');
const LIVEKIT_API_SECRET = requireEnv('LIVEKIT_API_SECRET');

// ── Brevo (email) ───────────────────────────────────────────────────────
const BREVO_API_KEY = requireEnv('BREVO_API_KEY', { productionOnly: true });
const BREVO_SENDER_EMAIL = requireEnv('BREVO_SENDER_EMAIL', { productionOnly: true });
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'MockMate';

// ── S3 Storage (production) ─────────────────────────────────────────────
const STORAGE_DRIVER = process.env.STORAGE_DRIVER || (isProduction ? 's3' : 'local');
const S3_BUCKET_NAME = requireEnv('S3_BUCKET_NAME', { productionOnly: STORAGE_DRIVER === 's3' });
const S3_REGION = process.env.S3_REGION || AWS_REGION;

if (isProduction && STORAGE_DRIVER === 'local') {
  errors.push('FATAL: STORAGE_DRIVER=local is not allowed in production. Use s3.');
}

// ── Internal API URL ────────────────────────────────────────────────────
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || `http://localhost:${PORT}/api`;

// ── Client URL ──────────────────────────────────────────────────────────
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ── Validate and report ─────────────────────────────────────────────────
function validateEnvironment() {
  if (warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation FAILED:');
    errors.forEach((e) => console.error(`   - ${e}`));
    if (isProduction) {
      console.error('❌ Cannot start in production with missing critical configuration.');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode despite errors above.');
    }
  } else {
    console.log('✅ Environment validation passed.');
  }
}

module.exports = {
  isProduction,
  PORT,
  NODE_ENV,
  JWT_SECRET,
  JWT_EXPIRE,
  AGENT_INTERNAL_SECRET,
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  BREVO_API_KEY,
  BREVO_SENDER_EMAIL,
  BREVO_SENDER_NAME,
  STORAGE_DRIVER,
  S3_BUCKET_NAME,
  S3_REGION,
  INTERNAL_API_URL,
  CLIENT_URL,
  validateEnvironment,
};
