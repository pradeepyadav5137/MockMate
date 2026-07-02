const express = require('express');
const router = express.Router();
const multer = require('multer');
const interviewController = require('../controllers/interviewController');
const { protect } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/create', protect, interviewController.createInterview);
router.get('/', protect, interviewController.getAll);
router.get('/:id', protect, interviewController.getOne);
router.get('/:id/token', protect, interviewController.getLivekitToken);
router.post('/:id/token', protect, interviewController.getLivekitToken);
router.post('/:id/end', (req, res, next) => {
  if (req.headers['x-internal-key'] === process.env.JWT_SECRET) return interviewController.endInterview(req, res, next);
  return protect(req, res, () => interviewController.endInterview(req, res, next));
});
router.post('/:id/recording', protect, upload.single('recording'), interviewController.uploadRecording);
router.get('/:id/feedback', protect, interviewController.getFeedback);
router.post('/:id/transcript', (req, res, next) => {
  if (req.headers['x-internal-key'] === process.env.JWT_SECRET) return interviewController.addTranscript(req, res, next);
  return protect(req, res, () => interviewController.addTranscript(req, res, next));
});
router.put('/:id/state', protect, interviewController.updateState);

module.exports = router;
