const Ticket = require('../models/Ticket');
const path = require('path');

// In-memory rate limiting for guest submissions (IP-based)
const guestRateMap = new Map();
const GUEST_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const GUEST_MAX_SUBMISSIONS = 3;

function checkGuestRateLimit(ip) {
  const now = Date.now();
  const entry = guestRateMap.get(ip);
  if (!entry || now - entry.windowStart > GUEST_RATE_WINDOW_MS) {
    guestRateMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= GUEST_MAX_SUBMISSIONS) {
    return false;
  }
  entry.count++;
  return true;
}

// Validation helpers
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeText(text, maxLength = 5000) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, maxLength);
}

// Create ticket — authenticated user
exports.createTicket = async (req, res) => {
  try {
    const { subject, category, description } = req.body;

    // Validate
    const cleanSubject = sanitizeText(subject, 200);
    const cleanDescription = sanitizeText(description, 5000);

    if (!cleanSubject || cleanSubject.length < 5) {
      return res.status(400).json({ success: false, message: 'Subject must be at least 5 characters.' });
    }
    if (!cleanDescription || cleanDescription.length < 10) {
      return res.status(400).json({ success: false, message: 'Description must be at least 10 characters.' });
    }
    if (category && !Ticket.VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category.' });
    }

    // Handle optional attachment
    let attachmentPath = null;
    let attachmentOriginalName = null;
    if (req.file) {
      attachmentPath = req.file.path;
      attachmentOriginalName = req.file.originalname;
    }

    const ticket = await Ticket.create({
      userId: req.user._id || req.user.id,
      isGuest: false,
      subject: cleanSubject,
      category: category || 'Other',
      description: cleanDescription,
      attachmentPath,
      attachmentOriginalName,
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully.',
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ success: false, message: 'Failed to create support ticket.' });
  }
};

// Create ticket — guest user
exports.createGuestTicket = async (req, res) => {
  try {
    // Rate limiting by IP
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (!checkGuestRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        message: 'Too many submissions. Please try again after 15 minutes.',
      });
    }

    const { email, subject, description } = req.body;

    // Validate email
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const cleanSubject = sanitizeText(subject, 200);
    const cleanDescription = sanitizeText(description, 5000);

    if (!cleanSubject || cleanSubject.length < 5) {
      return res.status(400).json({ success: false, message: 'Subject must be at least 5 characters.' });
    }
    if (!cleanDescription || cleanDescription.length < 10) {
      return res.status(400).json({ success: false, message: 'Description must be at least 10 characters.' });
    }

    const ticket = await Ticket.create({
      isGuest: true,
      guestEmail: email.toLowerCase().trim(),
      subject: cleanSubject,
      category: 'Other',
      description: cleanDescription,
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully.',
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    console.error('Create guest ticket error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit support ticket.' });
  }
};

// Get authenticated user's tickets
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const tickets = await Ticket.find({ userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      tickets: tickets.map((t) => ({
        id: t._id,
        ticketId: t.ticketId,
        subject: t.subject,
        category: t.category,
        description: t.description,
        status: t.status,
        attachmentPath: t.attachmentPath ? true : false, // Don't expose path
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (err) {
    console.error('Get my tickets error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

// Get single ticket by ID (authenticated user only sees their own)
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const userId = req.user._id || req.user.id;
    if (String(ticket.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({
      success: true,
      ticket: {
        id: ticket._id,
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        category: ticket.category,
        description: ticket.description,
        status: ticket.status,
        hasAttachment: !!ticket.attachmentPath,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket.' });
  }
};
