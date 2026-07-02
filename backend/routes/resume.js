const express = require('express');
const router = express.Router();
const { protect, requireVerified } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');
const { uploadResume: uploadResumeController, getResume } = require('../controllers/resumeController');

router.post('/upload', protect, requireVerified, uploadResume.single('resume'), uploadResumeController);
router.get('/', protect, getResume);

module.exports = router;
