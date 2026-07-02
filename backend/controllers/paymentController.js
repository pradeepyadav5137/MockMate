const Razorpay = require('razorpay');
const crypto = require('crypto');
const Interview = require('../models/Interview');
const { getRecordingDownloadUrl } = require('../services/storageService');

const createOrder = async (req, res) => {
  try {
    const { type, tier, interviewId } = req.body;
    let amount;
    if (type === 'interview') amount = tier === 'basic' ? 900 : 1900;
    else if (type === 'recording') {
      amount = 900;
      const interview = await Interview.findById(interviewId);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });
      if (String(interview.userId) !== String(req.user.id || req.user._id)) return res.status(403).json({ error: 'Unauthorized' });
      if (!interview.recordingExpiresAt || interview.recordingExpiresAt <= new Date()) return res.status(400).json({ error: 'Recording has expired and is no longer available.' });
    } else return res.status(400).json({ error: 'Invalid payment type' });

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: `mockmate_${Date.now()}` });
    res.json({ orderId: order.id, amount, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, type, interviewId, tier } = req.body;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    if (expectedSignature !== signature) return res.status(400).json({ error: 'Invalid signature' });

    if (type === 'interview') {
      if (interviewId) {
        const interview = await Interview.findById(interviewId);
        if (interview) {
          if (String(interview.userId) !== String(req.user.id || req.user._id)) return res.status(403).json({ error: 'Unauthorized' });
          interview.isPaid = true;
          interview.pricingTier = tier;
          interview.maxDurationMinutes = tier === 'basic' ? 30 : 50;
          interview.recordingUnlocked = tier === 'pro';
          interview.paymentId = paymentId;
          interview.orderId = orderId;
          await interview.save();
        }
      }
      return res.json({ success: true });
    }

    if (type === 'recording') {
      const interview = await Interview.findById(interviewId);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });
      if (String(interview.userId) !== String(req.user.id || req.user._id)) return res.status(403).json({ error: 'Unauthorized' });
      interview.recordingUnlocked = true;
      interview.paymentId = paymentId;
      interview.orderId = orderId;
      await interview.save();
      const downloadUrl = await getRecordingDownloadUrl(interview.recordingPath, interviewId);
      return res.json({ success: true, downloadUrl: downloadUrl.url });
    }

    res.status(400).json({ error: 'Invalid payment type' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createOrder, verifyPayment };
