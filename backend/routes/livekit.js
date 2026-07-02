const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const interviewController = require('../controllers/interviewController');

router.get('/token/:id', protect, interviewController.getLivekitToken);

module.exports = router;
