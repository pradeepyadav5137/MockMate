const Razorpay = require('razorpay');
const crypto = require('crypto');
const Interview = require('../models/Interview');
const Payment = require('../models/Payment');
const { getRecordingDownloadUrl } = require('../services/storageService');

const PRODUCT_MAP = {
  interview_basic: { amount: 900, label: 'Basic interview' },
  interview_pro: { amount: 1900, label: 'Pro interview' },
  recording_unlock: { amount: 900, label: 'Recording unlock' },
};

function initRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys are missing in environment.');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function getProductCode(type, tier) {
  if (type === 'interview') return `interview_${tier}`;
  if (type === 'recording' || type === 'recording_unlock') return 'recording_unlock';
  return null;
}

const createOrder = async (req, res) => {
  try {
    const { type, tier, interviewId, idempotencyKey } = req.body;
    const userId = req.user.id || req.user._id;

    const productCode = getProductCode(type, tier);
    if (!productCode || !PRODUCT_MAP[productCode]) {
      return res.status(400).json({ error: 'Invalid product details' });
    }
    const product = PRODUCT_MAP[productCode];

    // Verify interview ownership if applicable
    if (productCode === 'recording_unlock') {
      if (!interviewId) return res.status(400).json({ error: 'Interview ID is required' });
      const interview = await Interview.findById(interviewId);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });
      if (String(interview.userId) !== String(userId)) return res.status(403).json({ error: 'Unauthorized' });
      if (!interview.recordingExpiresAt || new Date(interview.recordingExpiresAt) <= new Date()) {
        return res.status(400).json({ error: 'Recording has expired and is no longer available.' });
      }
      if (interview.recordingUnlocked) {
        return res.status(400).json({ error: 'Recording is already unlocked.' });
      }
    }

    // Check for existing pending order via idempotencyKey
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ idempotencyKey, userId: String(userId) });
      if (existingPayment) {
        if (existingPayment.status === 'pending' || existingPayment.status === 'created') {
          console.log(`[Payment] Reusing existing order ${existingPayment.razorpayOrderId} for key ${idempotencyKey}`);
          return res.json({
            orderId: existingPayment.razorpayOrderId,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
          });
        }
        if (existingPayment.status === 'paid') {
          return res.status(400).json({ error: 'This order has already been paid.' });
        }
      }
    }

    const razorpay = initRazorpay();
    const orderOptions = {
      amount: product.amount,
      currency: 'INR',
      receipt: `mockmate_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };

    console.log(`[Payment] Creating Razorpay order for user ${userId}, product ${productCode}`);
    const order = await razorpay.orders.create(orderOptions);

    await Payment.create({
      userId: String(userId),
      productCode,
      tier: tier || null,
      amount: product.amount,
      currency: 'INR',
      razorpayOrderId: order.id,
      status: 'pending',
      idempotencyKey: idempotencyKey || null,
      interviewId: interviewId || null,
    });

    res.json({
      orderId: order.id,
      amount: product.amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(`[Payment] Error creating order: ${err.message}`);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, type, interviewId, tier } = req.body;
    const userId = req.user.id || req.user._id;

    console.log(`[Payment] Verifying payment for order ${orderId}, payment ${paymentId}`);

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn(`[Payment] Invalid signature for order ${orderId}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      console.error(`[Payment] Order ${orderId} not found in database.`);
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (String(payment.userId) !== String(userId)) {
      console.warn(`[Payment] User ${userId} attempted to verify order ${orderId} belonging to ${payment.userId}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (payment.status === 'paid') {
      console.log(`[Payment] Order ${orderId} is already paid. Proceeding idempotently.`);
      // Return success without granting benefits twice
      return handleIdempotentSuccess(payment, interviewId, res);
    }

    // Grant benefits exactly once
    try {
      await grantBenefits(payment);
      
      payment.status = 'paid';
      payment.razorpayPaymentId = paymentId;
      payment.paidAt = new Date().toISOString();
      await payment.save();

      console.log(`[Payment] Order ${orderId} verified and paid successfully.`);
      return handleIdempotentSuccess(payment, interviewId, res);
    } catch (benefitError) {
      console.error(`[Payment] Failed to grant benefits for order ${orderId}: ${benefitError.message}`);
      await autoRefund(payment.razorpayOrderId, paymentId, payment, 'internal_error');
      return res.status(500).json({ error: 'Payment captured but failed to grant benefits. Auto-refund initiated.' });
    }
  } catch (err) {
    console.error(`[Payment] Error verifying payment: ${err.message}`);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

async function handleIdempotentSuccess(payment, interviewId, res) {
  if (payment.productCode === 'recording_unlock') {
    const interview = await Interview.findById(interviewId || payment.interviewId);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    const downloadUrl = await getRecordingDownloadUrl(interview.recordingPath, interview._id);
    return res.json({ success: true, downloadUrl: downloadUrl.url });
  }
  return res.json({ success: true });
}

async function grantBenefits(payment) {
  if (payment.productCode.startsWith('interview_')) {
    if (payment.interviewId) {
      const interview = await Interview.findById(payment.interviewId);
      if (interview) {
        interview.isPaid = true;
        interview.pricingTier = payment.tier;
        interview.maxDurationMinutes = payment.tier === 'basic' ? 30 : 50;
        interview.recordingUnlocked = payment.tier === 'pro';
        interview.paymentId = payment.razorpayPaymentId || payment.razorpayOrderId;
        interview.orderId = payment.razorpayOrderId;
        await interview.save();
      }
    }
  } else if (payment.productCode === 'recording_unlock') {
    if (!payment.interviewId) throw new Error('Missing interviewId for recording unlock');
    const interview = await Interview.findById(payment.interviewId);
    if (!interview) throw new Error('Interview not found');
    interview.recordingUnlocked = true;
    interview.paymentId = payment.razorpayPaymentId || payment.razorpayOrderId;
    interview.orderId = payment.razorpayOrderId;
    await interview.save();
  }
}

async function autoRefund(orderId, paymentId, paymentRecord, reason) {
  if (paymentRecord.refundId || paymentRecord.status === 'refunded' || paymentRecord.status === 'refund_pending') {
    console.log(`[Payment] Refund already initiated for order ${orderId}`);
    return;
  }
  console.log(`[Payment] Initiating auto-refund for order ${orderId}, reason: ${reason}`);
  const razorpay = initRazorpay();
  try {
    paymentRecord.status = 'refund_pending';
    await paymentRecord.save();

    const refund = await razorpay.payments.refund(paymentId, {
      notes: { reason },
      receipt: `ref_${Date.now()}`
    });
    
    paymentRecord.refundId = refund.id;
    paymentRecord.refundStatus = refund.status; // usually 'processed' or 'pending'
    if (refund.status === 'processed') paymentRecord.status = 'refunded';
    await paymentRecord.save();
    console.log(`[Payment] Auto-refund successful for order ${orderId}, refund ID: ${refund.id}`);
  } catch (err) {
    console.error(`[Payment] Auto-refund failed for order ${orderId}: ${err.message}`);
    paymentRecord.status = 'refund_failed';
    await paymentRecord.save();
  }
}

const webhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Payment] Webhook secret not configured.');
    return res.status(200).send('OK');
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  try {
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expectedSignature !== signature) {
      console.warn('[Payment] Webhook signature mismatch.');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const { event: eventType, payload } = event;
    console.log(`[Payment] Webhook received: ${eventType}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment && payment.status === 'pending') {
          try {
            await grantBenefits(payment);
            payment.status = 'paid';
            payment.razorpayPaymentId = paymentId;
            payment.paidAt = new Date().toISOString();
            await payment.save();
            console.log(`[Payment] Webhook: Order ${orderId} marked as paid and benefits granted.`);
          } catch (err) {
            console.error(`[Payment] Webhook: Failed to grant benefits for ${orderId}: ${err.message}`);
            await autoRefund(orderId, paymentId, payment, 'internal_error_webhook');
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment && payment.status === 'pending') {
          payment.status = 'failed';
          await payment.save();
          console.log(`[Payment] Webhook: Order ${orderId} marked as failed.`);
        }
      }
    } else if (eventType === 'refund.processed') {
      const refundEntity = payload.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      if (paymentId) {
        const payment = await Payment.findOne({ razorpayPaymentId: paymentId });
        if (payment) {
          payment.status = 'refunded';
          payment.refundStatus = 'processed';
          payment.refundId = refundEntity.id;
          await payment.save();
          console.log(`[Payment] Webhook: Refund ${refundEntity.id} processed for payment ${paymentId}.`);
        }
      }
    } else if (eventType === 'refund.failed') {
      const refundEntity = payload.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      if (paymentId) {
        const payment = await Payment.findOne({ razorpayPaymentId: paymentId });
        if (payment) {
          payment.status = 'refund_failed';
          payment.refundStatus = 'failed';
          await payment.save();
          console.log(`[Payment] Webhook: Refund ${refundEntity.id} failed for payment ${paymentId}.`);
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(`[Payment] Webhook processing error: ${err.message}`);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = { createOrder, verifyPayment, webhook };
