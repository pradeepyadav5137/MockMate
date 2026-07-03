const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const Interview = require('../models/Interview');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const getUserId = (req) => String(req.user?.id || req.user?._id || '');

// Middleware that accepts auth via Bearer header OR ?token= query param (for <audio> elements)
const protectWithQueryToken = async (req, res, next) => {
  // Try standard header auth first
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const token = headerToken || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
};

// Secure streaming endpoint (for <audio> playback)
router.get('/recordings/:interviewId/stream', protectWithQueryToken, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (getUserId(req) !== String(interview.userId)) return res.status(403).json({ error: 'Unauthorized' });
    if (!interview.recordingPath || interview.recordingDeletedAt) {
      return res.status(404).json({ error: 'Recording not available' });
    }
    if (interview.recordingExpiresAt && new Date(interview.recordingExpiresAt) < new Date()) {
      return res.status(410).json({ error: 'Recording has expired' });
    }
    // Access check: Pro tier gets free access, others need recordingUnlocked
    if (interview.pricingTier !== 'pro' && !interview.recordingUnlocked) {
      return res.status(403).json({ error: 'Recording is locked. Unlock for ₹9 to access.' });
    }

    const filePath = path.resolve(interview.recordingPath);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Recording file not found on disk' });
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.webm': 'audio/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };
    const contentType = mimeMap[ext] || 'audio/webm';

    // Support range requests for seeking in audio player
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Stream recording error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Secure download endpoint
router.get('/recordings/:interviewId/download', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (getUserId(req) !== String(interview.userId)) return res.status(403).json({ error: 'Unauthorized' });
    if (!interview.recordingPath || interview.recordingDeletedAt) {
      return res.status(404).json({ error: 'Recording not available' });
    }
    if (interview.recordingExpiresAt && new Date(interview.recordingExpiresAt) < new Date()) {
      return res.status(410).json({ error: 'Recording has expired' });
    }
    // Access check: Pro tier gets free access, others need recordingUnlocked
    if (interview.pricingTier !== 'pro' && !interview.recordingUnlocked) {
      return res.status(403).json({ error: 'Recording is locked. Unlock for ₹9 to access.' });
    }

    const filePath = path.resolve(interview.recordingPath);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Recording file not found on disk' });
    }

    const ext = path.extname(filePath);
    const downloadName = `mockmate-interview-${req.params.interviewId}${ext}`;
    res.download(filePath, downloadName);
  } catch (err) {
    console.error('Download recording error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
