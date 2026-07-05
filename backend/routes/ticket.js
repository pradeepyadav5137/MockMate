const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const ticketController = require('../controllers/ticketController');

// Ensure uploads/tickets directory exists
const ticketUploadDir = path.join(__dirname, '..', 'uploads', 'tickets');
if (!fs.existsSync(ticketUploadDir)) {
  fs.mkdirSync(ticketUploadDir, { recursive: true });
}

// Multer config for ticket attachments (images only, stored locally)
const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ticketUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const ticketFileFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (PNG, JPG, GIF, WebP) are allowed'), false);
  }
};

const uploadTicketAttachment = multer({
  storage: ticketStorage,
  fileFilter: ticketFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// === Authenticated Routes ===
router.post('/create', protect, uploadTicketAttachment.single('attachment'), ticketController.createTicket);
router.get('/my', protect, ticketController.getMyTickets);
router.get('/:id', protect, ticketController.getTicketById);

// === Guest Route (public, no auth) ===
router.post('/guest', ticketController.createGuestTicket);

module.exports = router;
