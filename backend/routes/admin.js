const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const admin = require('../controllers/adminController');

// Every route requires: protect (auth) + requireAdmin (role check)
router.use(protect, requireAdmin);

// Dashboard
router.get('/stats', admin.getDashboardStats);

// Provider health
router.get('/providers', admin.getProviderHealth);

// Interviews
router.get('/interviews', admin.getInterviews);
router.get('/interviews/:id', admin.getInterviewDetail);

// Users
router.get('/users', admin.getUsers);
router.get('/users/:id', admin.getUserDetail);

// User Feedback
router.get('/feedbacks', admin.getFeedbacks);

// Support Tickets
router.get('/tickets', admin.getTickets);
router.put('/tickets/:id/status', admin.updateTicketStatus);

// Payments
router.get('/payments', admin.getPayments);

// CSV Export
router.get('/export/:type', admin.exportData);

module.exports = router;
