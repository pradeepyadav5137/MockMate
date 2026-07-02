const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getFeedback,
  getTranscript,
  getRecording,
  getDashboardStats,
} = require('../controllers/feedbackController');

router.get('/stats', protect, getDashboardStats);
router.get('/:interviewId', protect, getFeedback);
router.get('/:interviewId/transcript', protect, getTranscript);
router.get('/:interviewId/recording', protect, getRecording);

module.exports = router;
