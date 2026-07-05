const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createFeedback,
  getMyFeedback,
  checkFeedback,
  getFeedbackStats,
} = require('../controllers/userFeedbackController');

// All routes require authentication
router.post('/', protect, createFeedback);
router.get('/my', protect, getMyFeedback);
router.get('/check/:interviewId', protect, checkFeedback);
router.get('/stats', protect, getFeedbackStats);

module.exports = router;
