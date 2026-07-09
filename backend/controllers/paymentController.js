/**
 * Payment controller — production-safe Razorpay integration.
 * Uses centralized product pricing, idempotent order creation,
 * atomic state transitions, and shared payment finalization.
 *
 * SECURITY: Never trusts frontend for price, tier, duration, or entitlement.
 */
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Interview = require('../models/Interview');
const Payment = require('../models/Payment');
const { resolveProduct, PRODUCT_BY_CODE } = require('../config/products');
const { finalizePayment, PAYMENT_STATUS, BENEFIT_STATUS } = require('../services/paymentService');
const { getRecordingDownloadUrl } = require('../services/storageService');

function initRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys are missing in environment.');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// ── CREATE ORDER ────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const { type, tier, interviewId, idempotencyKey } = req.body;
    const userId = String(req.user.id || req.user._id);

    // Resolve product from backend mapping — never trust frontend amount
    const product = resolveProduct(type, tier);
    if (!product) {
      return res.status(400).json({ error: 'Invalid product details' });
    }

    // Validate interview ownership for all product types
    if (interviewId) {
      const interview = await Interview.findById(interviewId);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });
      if (String(interview.userId) !== userId) return res.status(403).json({ error: 'Unauthorized' });

      // Recording unlock validations
      if (product.code === 'recording_unlock') {
        // SECURITY: Reject if Pro already includes recording
        if (interview.pricingTier === 'pro') {
          return res.status(400).json({ error: 'Recording is already included free with your Pro interview.' });
        }
        if (!interview.recordingExpiresAt || new Date(interview.recordingExpiresAt) <= new Date()) {
          return res.status(400).json({ error: 'Recording has expired and is no longer available.' });
        }
        if (interview.recordingUnlocked) {
          return res.status(400).json({ error: 'Recording is already unlocked.' });
        }
      }
    } else if (product.code === 'recording_unlock') {
      return res.status(400).json({ error: 'Interview ID is required for recording unlock.' });
    }

    // ── Idempotency: check for existing pending order ───────────────────
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ idempotencyKey });
      if (existingPayment && String(existingPayment.userId) === userId) {
        const status = existingPayment.paymentStatus || existingPayment.status;
        if (status === PAYMENT_STATUS.PENDING || status === PAYMENT_STATUS.CREATED || status === 'pending' || status === 'created') {
          console.log(`[Payment] Reusing existing order ${existingPayment.razorpayOrderId} for key ${idempotencyKey}`);
          return res.json({
            orderId: existingPayment.razorpayOrderId,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
          });
        }
        if (status === PAYMENT_STATUS.PAID || status === 'paid') {
          return res.status(400).json({ error: 'This order has already been paid.' });
        }
      }
    }

    // ── Create Razorpay order ───────────────────────────────────────────
    const razorpay = initRazorpay();
    const receipt = `mm_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const orderOptions = {
      amount: product.amount,
      currency: product.currency || 'INR',
      receipt,
      notes: {
        userId,
        productCode: product.code,
        interviewId: interviewId || '',
      },
    };

    console.log(`[Payment] Creating Razorpay order for user ${userId}, product ${product.code}, amount ${product.amount} paise`);
    const order = await razorpay.orders.create(orderOptions);

    // ── Persist payment record ──────────────────────────────────────────
    await Payment.create({
      userId,
      productCode: product.code,
      tier: product.tier || null,
      amount: product.amount,
      expectedAmount: product.amount,
      currency: product.currency || 'INR',
      razorpayOrderId: order.id,
      razorpayReceipt: receipt,
      status: PAYMENT_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      benefitStatus: BENEFIT_STATUS.NOT_GRANTED,
      idempotencyKey: idempotencyKey || null,
      interviewId: interviewId || null,
      durationMinutes: product.durationMinutes || null,
      recordingIncluded: product.recordingIncluded || false,
    });

    res.json({
      orderId: order.id,
      amount: product.amount,
      currency: product.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(`[Payment] Error creating order: ${err.message}`);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// ── VERIFY PAYMENT ──────────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const userId = String(req.user.id || req.user._id);

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification data' });
    }

    console.log(`[Payment] Verifying payment for order ${orderId}`);

    // ── Verify HMAC signature (timing-safe) ─────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn(`[Payment] Invalid signature for order ${orderId}`);
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // ── Load payment record from DynamoDB ────────────────────────────────
    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      console.error(`[Payment] Order ${orderId} not found in database`);
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // ── Verify ownership ────────────────────────────────────────────────
    if (String(payment.userId) !== userId) {
      console.warn(`[Payment] User ${userId} attempted to verify order belonging to ${payment.userId}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // ── Store razorpayPaymentId FIRST (before any benefit logic) ─────────
    // SECURITY: Never store razorpayOrderId as paymentId
    if (!payment.razorpayPaymentId) {
      payment.razorpayPaymentId = paymentId;
      await payment.save();
    }

    // ── Already paid? Return idempotently ───────────────────────────────
    const status = payment.paymentStatus || payment.status;
    if (status === PAYMENT_STATUS.PAID || status === 'paid') {
      console.log(`[Payment] Order ${orderId} already paid — returning idempotently`);
      return handleVerificationSuccess(payment, res);
    }

    // ── Finalize payment (shared with webhook) ──────────────────────────
    try {
      const result = await finalizePayment(payment.id || payment._id, paymentId);

      if (result.alreadyProcessed) {
        return handleVerificationSuccess(result.payment, res);
      }

      console.log(`[Payment] Order ${orderId} verified and paid successfully`);
      return handleVerificationSuccess(result.payment, res);
    } catch (benefitError) {
      console.error(`[Payment] Benefit grant failed for ${orderId}: ${benefitError.message}`);
      // Attempt auto-refund
      await autoRefund(orderId, paymentId, payment, 'benefit_grant_failed');
      return res.status(500).json({ error: 'Payment captured but failed to grant benefits. Auto-refund initiated.' });
    }
  } catch (err) {
    console.error(`[Payment] Verification error: ${err.message}`);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

async function handleVerificationSuccess(payment, res) {
  if (payment.productCode === 'recording_unlock') {
    const interview = await Interview.findById(payment.interviewId);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    const downloadUrl = await getRecordingDownloadUrl(interview.recordingPath, interview._id);
    return res.json({ success: true, downloadUrl: downloadUrl.url });
  }
  return res.json({ success: true });
}

// ── AUTO-REFUND ─────────────────────────────────────────────────────────
async function autoRefund(orderId, paymentId, paymentRecord, reason) {
  const currentStatus = paymentRecord.paymentStatus || paymentRecord.status;
  if (paymentRecord.refundId || currentStatus === PAYMENT_STATUS.REFUNDED || currentStatus === PAYMENT_STATUS.REFUND_PENDING) {
    console.log(`[Payment] Refund already initiated for order ${orderId}`);
    return;
  }

  console.log(`[Payment] Initiating auto-refund for order ${orderId}, reason: ${reason}`);
  const razorpay = initRazorpay();

  try {
    paymentRecord.paymentStatus = PAYMENT_STATUS.REFUND_PENDING;
    paymentRecord.status = PAYMENT_STATUS.REFUND_PENDING;
    paymentRecord.refundReason = reason;
    paymentRecord.refundRequestedAt = new Date().toISOString();
    await paymentRecord.save();

    const refund = await razorpay.payments.refund(paymentId, {
      notes: { reason },
      receipt: `ref_${Date.now()}`,
    });

    paymentRecord.refundId = refund.id;
    paymentRecord.refundAmount = refund.amount;
    paymentRecord.refundStatus = refund.status;
    if (refund.status === 'processed') {
      paymentRecord.paymentStatus = PAYMENT_STATUS.REFUNDED;
      paymentRecord.status = PAYMENT_STATUS.REFUNDED;
      paymentRecord.refundCompletedAt = new Date().toISOString();
    }
    await paymentRecord.save();
    console.log(`[Payment] Auto-refund successful for order ${orderId}, refund ID: ${refund.id}`);
  } catch (err) {
    console.error(`[Payment] Auto-refund failed for order ${orderId}: ${err.message}`);
    paymentRecord.paymentStatus = PAYMENT_STATUS.MANUAL_REVIEW;
    paymentRecord.status = PAYMENT_STATUS.MANUAL_REVIEW;
    paymentRecord.reconciliationStatus = 'refund_failed';
    await paymentRecord.save();
  }
}

// ── WEBHOOK ─────────────────────────────────────────────────────────────
const webhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Payment] Webhook secret not configured — rejecting webhook');
    return res.status(400).json({ error: 'Webhook not configured' });
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing signature' });
  }

  // SECURITY: Use exact raw body for signature verification — never re-stringify
  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error('[Payment] Raw body not available for webhook verification');
    return res.status(400).json({ error: 'Raw body not available' });
  }

  try {
    // Timing-safe HMAC verification
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn('[Payment] Webhook signature mismatch');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const eventType = event.event;
    const payload = event.payload;

    console.log(`[Payment] Webhook received: ${eventType}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const rpPaymentId = paymentEntity?.id;

      if (orderId && rpPaymentId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment) {
          const status = payment.paymentStatus || payment.status;
          if (status === PAYMENT_STATUS.PENDING || status === 'pending') {
            try {
              // Shared finalization — same as client verification
              await finalizePayment(payment.id || payment._id, rpPaymentId);
              console.log(`[Payment] Webhook: Order ${orderId} finalized`);
            } catch (err) {
              console.error(`[Payment] Webhook: Failed to finalize ${orderId}: ${err.message}`);
              await autoRefund(orderId, rpPaymentId, payment, 'webhook_benefit_failed');
            }
          } else {
            console.log(`[Payment] Webhook: Order ${orderId} already in state ${status}, skipping`);
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment) {
          const status = payment.paymentStatus || payment.status;
          if (status === PAYMENT_STATUS.PENDING || status === 'pending') {
            payment.paymentStatus = PAYMENT_STATUS.FAILED;
            payment.status = PAYMENT_STATUS.FAILED;
            payment.updatedAt = new Date().toISOString();
            await payment.save();
            console.log(`[Payment] Webhook: Order ${orderId} marked as failed`);
          }
        }
      }
    } else if (eventType === 'refund.processed') {
      const refundEntity = payload.refund?.entity;
      const rpPaymentId = refundEntity?.payment_id;
      if (rpPaymentId) {
        const payment = await Payment.findOne({ razorpayPaymentId: rpPaymentId });
        if (payment) {
          payment.paymentStatus = PAYMENT_STATUS.REFUNDED;
          payment.status = PAYMENT_STATUS.REFUNDED;
          payment.refundStatus = 'processed';
          payment.refundId = refundEntity.id;
          payment.refundCompletedAt = new Date().toISOString();
          await payment.save();
          console.log(`[Payment] Webhook: Refund ${refundEntity.id} processed`);
        }
      }
    } else if (eventType === 'refund.failed') {
      const refundEntity = payload.refund?.entity;
      const rpPaymentId = refundEntity?.payment_id;
      if (rpPaymentId) {
        const payment = await Payment.findOne({ razorpayPaymentId: rpPaymentId });
        if (payment) {
          payment.paymentStatus = PAYMENT_STATUS.MANUAL_REVIEW;
          payment.status = PAYMENT_STATUS.MANUAL_REVIEW;
          payment.refundStatus = 'failed';
          payment.reconciliationStatus = 'refund_failed';
          await payment.save();
          console.log(`[Payment] Webhook: Refund failed for payment ${rpPaymentId}`);
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(`[Payment] Webhook processing error: ${err.message}`);
    // Return 200 to prevent Razorpay retries for processing errors
    res.status(200).send('Processing error logged');
  }
};

module.exports = { createOrder, verifyPayment, webhook };
