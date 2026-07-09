/**
 * Centralized payment finalization service.
 * Both client verification and webhook call this single service.
 * Prevents duplicate benefit grants via DynamoDB conditional updates.
 *
 * SECURITY: All entitlement decisions come from the Payment record in DynamoDB,
 * NEVER from frontend-supplied values.
 */
const { PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, isPlaceholderKey } = require('../config/dynamodb');
const Interview = require('../models/Interview');
const Payment = require('../models/Payment');
const { PRODUCT_BY_CODE, PRODUCTS } = require('../config/products');

const PAYMENT_TABLE = process.env.DYNAMODB_PAYMENT_TABLE || 'MockMate_Payments';

/**
 * Payment status state machine.
 * Valid transitions enforced by DynamoDB ConditionExpressions.
 */
const PAYMENT_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
};

const BENEFIT_STATUS = {
  NOT_GRANTED: 'NOT_GRANTED',
  GRANTING: 'GRANTING',
  GRANTED: 'GRANTED',
  REVOKE_PENDING: 'REVOKE_PENDING',
  REVOKED: 'REVOKED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
};

/**
 * Atomically transition payment status using DynamoDB conditional update.
 * Only one request wins the race.
 * Returns true if transition succeeded, false if already in target/later state.
 */
const localLocks = new Set();

async function transitionPaymentStatus(paymentId, fromStatus, toStatus, additionalUpdates = {}) {
  if (!docClient || isPlaceholderKey) {
    if (localLocks.has(paymentId)) {
      return false;
    }
    localLocks.add(paymentId);
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) return false;
      const currentStatus = payment.paymentStatus || payment.status;
      if (currentStatus !== fromStatus) return false;
      payment.paymentStatus = toStatus;
      payment.status = toStatus;
      Object.assign(payment, additionalUpdates);
      payment.updatedAt = new Date().toISOString();
      await payment.save();
      return true;
    } finally {
      localLocks.delete(paymentId);
    }
  }

  try {
    let updateExpr = 'SET paymentStatus = :toStatus, #st = :toStatus, updatedAt = :now';
    const exprValues = {
      ':fromStatus': fromStatus,
      ':toStatus': toStatus,
      ':now': new Date().toISOString(),
    };
    const exprNames = { '#st': 'status' };

    // Add additional update fields
    let idx = 0;
    for (const [key, val] of Object.entries(additionalUpdates)) {
      const placeholder = `:upd${idx}`;
      const namePlaceholder = `#upd${idx}`;
      updateExpr += `, ${namePlaceholder} = ${placeholder}`;
      exprValues[placeholder] = val;
      exprNames[namePlaceholder] = key;
      idx++;
    }

    await docClient.send(new UpdateCommand({
      TableName: PAYMENT_TABLE,
      Key: { id: paymentId },
      UpdateExpression: updateExpr,
      // Accept transition from either paymentStatus or legacy status field
      ConditionExpression: 'paymentStatus = :fromStatus OR #st = :fromStatus',
      ExpressionAttributeValues: exprValues,
      ExpressionAttributeNames: exprNames,
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`[PaymentService] Status transition ${fromStatus} → ${toStatus} rejected for ${paymentId} (already transitioned)`);
      return false;
    }
    throw err;
  }
}

/**
 * Idempotent benefit granting.
 * Uses product configuration from Payment record, NOT from frontend.
 * Calling multiple times produces the same result.
 */
async function grantBenefits(paymentId) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('Payment record not found');

  // Already granted? Return idempotently.
  if (payment.benefitStatus === BENEFIT_STATUS.GRANTED) {
    console.log(`[PaymentService] Benefits already granted for ${paymentId}`);
    return { alreadyGranted: true };
  }

  // Mark as granting
  const locked = await transitionPaymentStatus(paymentId,
    payment.paymentStatus || payment.status,
    payment.paymentStatus || payment.status,
    { benefitStatus: BENEFIT_STATUS.GRANTING }
  );

  const product = PRODUCT_BY_CODE[payment.productCode];
  if (!product) throw new Error(`Unknown product code: ${payment.productCode}`);

  try {
    if (payment.productCode === 'interview_basic' || payment.productCode === 'interview_pro') {
      if (payment.interviewId) {
        const interview = await Interview.findById(payment.interviewId);
        if (interview) {
          // Idempotency: only update if not already paid by this payment
          if (interview.paymentId !== payment.razorpayPaymentId) {
            interview.isPaid = true;
            interview.pricingTier = product.tier;
            interview.maxDurationMinutes = product.durationMinutes;
            // Pro includes free recording
            if (product.recordingIncluded) {
              interview.recordingUnlocked = true;
              interview.recordingEntitlementSource = 'PRO_INCLUDED';
            }
            interview.paymentId = payment.razorpayPaymentId;
            interview.orderId = payment.razorpayOrderId;
            await interview.save();
          }
        }
      }
    } else if (payment.productCode === 'recording_unlock') {
      if (!payment.interviewId) throw new Error('Missing interviewId for recording unlock');
      const interview = await Interview.findById(payment.interviewId);
      if (!interview) throw new Error('Interview not found');

      // SECURITY: Reject if Pro already includes recording
      if (interview.pricingTier === 'pro' && interview.recordingEntitlementSource === 'PRO_INCLUDED') {
        throw new Error('Recording is already included with Pro — cannot charge ₹9');
      }

      // Idempotency: only unlock if not already unlocked by this payment
      if (!interview.recordingUnlocked || interview.recordingEntitlementSource !== 'PAID_RECORDING_UNLOCK') {
        interview.recordingUnlocked = true;
        interview.recordingEntitlementSource = 'PAID_RECORDING_UNLOCK';
        interview.paymentId = payment.razorpayPaymentId;
        interview.orderId = payment.razorpayOrderId;
        await interview.save();
      }
    }

    // Mark benefits as granted
    await transitionPaymentStatus(paymentId,
      payment.paymentStatus || payment.status || PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.PAID,
      { benefitStatus: BENEFIT_STATUS.GRANTED }
    );

    return { success: true };
  } catch (err) {
    console.error(`[PaymentService] Benefit grant failed for ${paymentId}: ${err.message}`);
    // Move to MANUAL_REVIEW if benefit grant partially failed
    await transitionPaymentStatus(paymentId,
      PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.MANUAL_REVIEW,
      { benefitStatus: BENEFIT_STATUS.MANUAL_REVIEW, benefitError: err.message }
    ).catch(() => {});
    throw err;
  }
}

/**
 * Shared finalization logic — called by both client verification and webhooks.
 * Ensures only one caller can process the payment via atomic state transition.
 */
async function finalizePayment(paymentId, razorpayPaymentId) {
  // Atomic: PENDING → PROCESSING (only one request wins)
  const transitioned = await transitionPaymentStatus(
    paymentId,
    PAYMENT_STATUS.PENDING,
    PAYMENT_STATUS.PROCESSING,
    { razorpayPaymentId }
  );

  if (!transitioned) {
    // Already processing or processed — return current state idempotently
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const status = payment.paymentStatus || payment.status;
    if (status === PAYMENT_STATUS.PAID || status === PAYMENT_STATUS.PROCESSING) {
      return { alreadyProcessed: true, payment };
    }
    if (status === PAYMENT_STATUS.FAILED || status === PAYMENT_STATUS.REFUNDED) {
      throw new Error(`Payment is in terminal state: ${status}`);
    }
    return { alreadyProcessed: true, payment };
  }

  // Grant benefits
  try {
    await grantBenefits(paymentId);

    // PROCESSING → PAID
    await transitionPaymentStatus(paymentId, PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.PAID, {
      paidAt: new Date().toISOString(),
    });

    const payment = await Payment.findById(paymentId);
    return { success: true, payment };
  } catch (err) {
    console.error(`[PaymentService] Finalization failed for ${paymentId}: ${err.message}`);
    throw err;
  }
}

module.exports = {
  PAYMENT_STATUS,
  BENEFIT_STATUS,
  transitionPaymentStatus,
  grantBenefits,
  finalizePayment,
};
