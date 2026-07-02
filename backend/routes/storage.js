const express = require('express');
const path = require('path');
const Interview = require('../models/Interview');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/recordings/:interviewId/download', protect, async (req, res) => {
  const interview = await Interview.findById(req.params.interviewId);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (String(interview.userId) !== String(req.user.id || req.user._id)) return res.status(403).json({ error: 'Unauthorized' });
  if (!interview.recordingPath || interview.recordingDeletedAt) return res.status(404).json({ error: 'Recording not available' });
  res.download(path.resolve(interview.recordingPath));
});

module.exports = router;
