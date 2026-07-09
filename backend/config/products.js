/**
 * Centralized product configuration — single source of truth for pricing.
 * Backend NEVER trusts frontend amounts, durations, or tier claims.
 */

const PRODUCTS = {
  BASIC_INTERVIEW: {
    code: 'interview_basic',
    amount: 900,        // paise (₹9)
    currency: 'INR',
    durationMinutes: 30,
    recordingIncluded: false,
    label: 'Basic Interview (₹9)',
    tier: 'basic',
  },
  PRO_INTERVIEW: {
    code: 'interview_pro',
    amount: 2900,       // paise (₹29)
    currency: 'INR',
    durationMinutes: 50,
    recordingIncluded: true,  // Pro includes recording FREE — never charge extra ₹9
    label: 'Pro Interview (₹29)',
    tier: 'pro',
  },
  RECORDING_UNLOCK: {
    code: 'recording_unlock',
    amount: 900,        // paise (₹9)
    currency: 'INR',
    label: 'Recording Unlock (₹9)',
  },
};

// Duration rules by tier (backend is the source of truth)
const TIER_DURATIONS = {
  free: 15,
  basic: 30,
  pro: 50,
};

// Map product code to product
const PRODUCT_BY_CODE = {};
Object.values(PRODUCTS).forEach((p) => {
  PRODUCT_BY_CODE[p.code] = p;
});

/**
 * Resolve product from request parameters.
 * Never trusts frontend amount/duration — always uses backend map.
 */
function resolveProduct(type, tier) {
  if (type === 'interview' || type === 'interview_basic' || type === 'interview_pro') {
    if (tier === 'basic') return PRODUCTS.BASIC_INTERVIEW;
    if (tier === 'pro') return PRODUCTS.PRO_INTERVIEW;
    return null;
  }
  if (type === 'recording' || type === 'recording_unlock') {
    return PRODUCTS.RECORDING_UNLOCK;
  }
  return null;
}

module.exports = {
  PRODUCTS,
  PRODUCT_BY_CODE,
  TIER_DURATIONS,
  resolveProduct,
};
