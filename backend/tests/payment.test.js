/**
 * Integration & Unit tests for Payment & Entitlements logic.
 * Covers:
 * - State machine status transitions.
 * - Idempotent benefit granting.
 * - Basic vs Pro entitlements (duration, recording unlocks).
 * - Concurrency processing simulation.
 */
const { finalizePayment, PAYMENT_STATUS, BENEFIT_STATUS } = require('../services/paymentService');
const Payment = require('../models/Payment');
const Interview = require('../models/Interview');
const User = require('../models/User');

describe('💳 Payment & Entitlements System', () => {
  let testUser;
  let basicInterview;
  let proInterview;

  beforeAll(async () => {
    // Setup standard credentials and test user
    testUser = await User.create({
      name: 'Tester',
      email: 'tester@mockmate.in',
      password: 'password123',
    });

    basicInterview = await Interview.create({
      userId: testUser.id || testUser._id,
      role: 'Frontend Developer',
      difficulty: 'medium',
      pricingTier: 'free', // initially free
      maxDurationMinutes: 15,
      isPaid: false,
    });

    proInterview = await Interview.create({
      userId: testUser.id || testUser._id,
      role: 'Backend Developer',
      difficulty: 'hard',
      pricingTier: 'free',
      maxDurationMinutes: 15,
      isPaid: false,
    });
  });

  describe('Pricing & Entitlement Mapping', () => {
    it('should correctly configure Basic interview entitlement to 30 mins and lock recording', async () => {
      const payment = await Payment.create({
        userId: testUser.id || testUser._id,
        productCode: 'interview_basic',
        interviewId: basicInterview.id || basicInterview._id,
        status: PAYMENT_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        benefitStatus: BENEFIT_STATUS.NOT_GRANTED,
        amount: 900,
        currency: 'INR',
      });

      // Finalize the payment
      const res = await finalizePayment(payment.id || payment._id, 'pay_basic_123');
      expect(res.success || res.alreadyProcessed).toBe(true);

      const updatedInterview = await Interview.findById(basicInterview.id || basicInterview._id);
      expect(updatedInterview.isPaid).toBe(true);
      expect(updatedInterview.pricingTier).toBe('basic');
      expect(updatedInterview.maxDurationMinutes).toBe(30);
      expect(updatedInterview.recordingUnlocked).toBeFalsy(); // Basic does NOT include recording free
    });

    it('should correctly configure Pro interview entitlement to 50 mins and include recording', async () => {
      const payment = await Payment.create({
        userId: testUser.id || testUser._id,
        productCode: 'interview_pro',
        interviewId: proInterview.id || proInterview._id,
        status: PAYMENT_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        benefitStatus: BENEFIT_STATUS.NOT_GRANTED,
        amount: 2900,
        currency: 'INR',
      });

      // Finalize the payment
      const res = await finalizePayment(payment.id || payment._id, 'pay_pro_123');
      expect(res.success || res.alreadyProcessed).toBe(true);

      const updatedInterview = await Interview.findById(proInterview.id || proInterview._id);
      expect(updatedInterview.isPaid).toBe(true);
      expect(updatedInterview.pricingTier).toBe('pro');
      expect(updatedInterview.maxDurationMinutes).toBe(50);
      expect(updatedInterview.recordingUnlocked).toBe(true); // Pro includes recording FREE
      expect(updatedInterview.recordingEntitlementSource).toBe('PRO_INCLUDED');
    });

    it('should allow standalone recording unlock for non-Pro interviews for ₹9', async () => {
      // Setup a completed basic interview
      const completedBasic = await Interview.create({
        userId: testUser.id || testUser._id,
        role: 'Frontend Developer',
        difficulty: 'medium',
        pricingTier: 'basic',
        maxDurationMinutes: 30,
        isPaid: true,
        recordingUnlocked: false,
      });

      const payment = await Payment.create({
        userId: testUser.id || testUser._id,
        productCode: 'recording_unlock',
        interviewId: completedBasic.id || completedBasic._id,
        status: PAYMENT_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        benefitStatus: BENEFIT_STATUS.NOT_GRANTED,
        amount: 900,
        currency: 'INR',
      });

      // Finalize the recording unlock payment
      const res = await finalizePayment(payment.id || payment._id, 'pay_rec_123');
      expect(res.success || res.alreadyProcessed).toBe(true);

      const updatedInterview = await Interview.findById(completedBasic.id || completedBasic._id);
      expect(updatedInterview.recordingUnlocked).toBe(true);
      expect(updatedInterview.recordingEntitlementSource).toBe('PAID_RECORDING_UNLOCK');
    });
  });

  describe('Webhook & Client Verification Concurrency Integrity', () => {
    it('should process only one request when webhook and verification race simultaneously', async () => {
      const racingInterview = await Interview.create({
        userId: testUser.id || testUser._id,
        role: 'Frontend Developer',
        difficulty: 'medium',
        pricingTier: 'free',
        maxDurationMinutes: 15,
        isPaid: false,
      });

      const payment = await Payment.create({
        userId: testUser.id || testUser._id,
        productCode: 'interview_basic',
        interviewId: racingInterview.id || racingInterview._id,
        status: PAYMENT_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        benefitStatus: BENEFIT_STATUS.NOT_GRANTED,
        amount: 900,
        currency: 'INR',
      });

      // Simulate concurrent requests firing simultaneously
      const [attempt1, attempt2] = await Promise.allSettled([
        finalizePayment(payment.id || payment._id, 'pay_race_999'),
        finalizePayment(payment.id || payment._id, 'pay_race_999'),
      ]);

      // Asserting at least one was successful and returned success/processed
      const results = [attempt1, attempt2];
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).toBe(2); // both resolve without throwing

      // One took processing and finalized, the other detected it was already processed/processing
      const values = fulfilled.map(r => r.value);
      const wasSuccess = values.some(v => v.success === true);
      const wasAlreadyProcessed = values.some(v => v.alreadyProcessed === true);

      expect(wasSuccess).toBe(true);
      expect(wasAlreadyProcessed).toBe(true);
    });
  });
});
