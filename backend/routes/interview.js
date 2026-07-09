const express = require('express');
const router = express.Router();
const multer = require('multer');
const interviewController = require('../controllers/interviewController');
const { protect, requireInternalAuth, protectOrInternal } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/create', protect, interviewController.createInterview);

// Internal-only routes (agent → backend) using AGENT_INTERNAL_SECRET
router.post('/:id/start-timing', requireInternalAuth, interviewController.setTiming);

router.get('/', protect, interviewController.getAll);
router.get('/:id', protect, interviewController.getOne);
router.get('/:id/token', protect, interviewController.getLivekitToken);
router.post('/:id/token', protect, interviewController.getLivekitToken);

// End interview — internal agent OR authenticated user
router.post('/:id/end', protectOrInternal, interviewController.endInterview);

router.post('/:id/recording', protect, upload.single('recording'), interviewController.uploadRecording);
router.get('/:id/feedback', protect, interviewController.getFeedback);

// Transcript — internal agent OR authenticated user
router.post('/:id/transcript', protectOrInternal, interviewController.addTranscript);

router.put('/:id/state', protect, interviewController.updateState);

module.exports = router;
