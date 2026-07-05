const Interview = require('../models/Interview');
const User = require('../models/User');
const UserFeedback = require('../models/UserFeedback');
const Ticket = require('../models/Ticket');

// ─── Cached provider health (in-memory, refreshed periodically) ──────
let providerHealthCache = {
  lastChecked: null,
  providers: {},
};

const checkProviderHealth = async () => {
  const results = {};
  const check = async (name, testFn) => {
    const start = Date.now();
    try {
      await testFn();
      results[name] = { status: 'healthy', latency: Date.now() - start, lastChecked: new Date().toISOString() };
    } catch (err) {
      results[name] = { status: 'down', error: err.message?.slice(0, 100), latency: Date.now() - start, lastChecked: new Date().toISOString() };
    }
  };

  // Deepgram STT
  if (process.env.DEEPGRAM_API_KEY) {
    await check('deepgram_stt', async () => {
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  } else {
    results.deepgram_stt = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // Cartesia TTS
  if (process.env.CARTESIA_API_KEY) {
    await check('cartesia_tts', async () => {
      const res = await fetch('https://api.cartesia.ai/voices', {
        headers: { 'X-API-Key': process.env.CARTESIA_API_KEY, 'Cartesia-Version': '2024-06-10' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  } else {
    results.cartesia_tts = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // Groq LLM
  if (process.env.GROQ_API_KEY) {
    await check('groq_llm', async () => {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  } else {
    results.groq_llm = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // Cerebras LLM
  if (process.env.CEREBRAS_API_KEY) {
    await check('cerebras_llm', async () => {
      const res = await fetch('https://api.cerebras.ai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  } else {
    results.cerebras_llm = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // Mistral LLM
  if (process.env.MISTRAL_API_KEY) {
    await check('mistral_llm', async () => {
      const res = await fetch('https://api.mistral.ai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  } else {
    results.mistral_llm = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // Gemini LLM
  if (process.env.GEMINI_API_KEY) {
    await check('gemini_llm', async () => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  } else {
    results.gemini_llm = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // Razorpay
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    results.razorpay = { status: 'configured', lastChecked: new Date().toISOString() };
  } else {
    results.razorpay = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // LiveKit
  if (process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY) {
    results.livekit = { status: 'configured', lastChecked: new Date().toISOString() };
  } else {
    results.livekit = { status: 'not_configured', lastChecked: new Date().toISOString() };
  }

  // DynamoDB
  const { docClient, isPlaceholderKey } = require('../config/dynamodb');
  results.dynamodb = {
    status: (docClient && !isPlaceholderKey) ? 'healthy' : 'local_fallback',
    lastChecked: new Date().toISOString(),
  };

  providerHealthCache = { lastChecked: new Date().toISOString(), providers: results };
  return results;
};

// Run health check on startup and every 5 minutes
checkProviderHealth().catch(() => {});
setInterval(() => checkProviderHealth().catch(() => {}), 5 * 60 * 1000);

// ─── Helper ──────────────────────────────────────────────────────────
const sanitizeUser = (u) => {
  if (!u) return null;
  const obj = typeof u.toObject === 'function' ? u.toObject() : { ...u };
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationTokenExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.comparePassword;
  delete obj.save;
  delete obj.toObject;
  return obj;
};

const paginate = (items, page = 1, limit = 20) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const total = items.length;
  const totalPages = Math.ceil(total / l);
  const start = (p - 1) * l;
  return {
    items: items.slice(start, start + l),
    pagination: { page: p, limit: l, total, totalPages },
  };
};

// ─── Dashboard Stats ─────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const { range } = req.query; // today, 7d, 30d, all
    const now = new Date();
    let since = null;

    if (range === 'today') since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '30d') since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [allInterviews, allUsers, allFeedbacks, allTickets] = await Promise.all([
      Interview.find({}),
      User.findAll(),
      UserFeedback.find({}).sort({ createdAt: -1 }),
      Ticket.find({}).sort({ createdAt: -1 }),
    ]);

    const filterByDate = (items, dateField = 'createdAt') => {
      if (!since) return items;
      return items.filter(i => i[dateField] && new Date(i[dateField]) >= since);
    };

    const interviews = filterByDate(allInterviews);
    const users = filterByDate(allUsers);
    const feedbacks = filterByDate(allFeedbacks);
    const tickets = filterByDate(allTickets);

    const completedInterviews = interviews.filter(i => i.status === 'completed');
    const failedInterviews = interviews.filter(i => i.status === 'failed' || i.status === 'cancelled');

    // Always calculate today's interviews regardless of the current range filter
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const interviewsToday = allInterviews.filter(i => i.createdAt && new Date(i.createdAt) >= todayStart).length;

    // Revenue from paid interviews
    const paidInterviews = interviews.filter(i => i.isPaid && i.paymentId);
    let revenue = 0;
    paidInterviews.forEach(i => {
      if (i.pricingTier === 'basic') revenue += 9;
      else if (i.pricingTier === 'pro') revenue += 19;
    });
    // Recording unlocks (non-pro with recordingUnlocked + paymentId)
    const recordingUnlocks = interviews.filter(i => i.recordingUnlocked && i.pricingTier !== 'pro' && i.paymentId);
    revenue += recordingUnlocks.length * 9;

    // Average and Total duration
    const durations = completedInterviews.map(i => i.actualDuration).filter(Boolean);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const avgDuration = durations.length ? Math.round(totalDuration / durations.length) : 0;

    // Recent items
    const recentInterviews = allInterviews
      .sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1)
      .slice(0, 10)
      .map(i => ({
        _id: i._id || i.id,
        userId: i.userId,
        role: i.role,
        interviewType: i.interviewType,
        status: i.status,
        pricingTier: i.pricingTier,
        actualDuration: i.actualDuration,
        createdAt: i.createdAt,
      }));

    const recentFeedbacks = (allFeedbacks || []).slice(0, 10).map(f => {
      const obj = typeof f.toObject === 'function' ? f.toObject() : { ...f };
      return {
        _id: obj._id || obj.id,
        userId: obj.userId,
        interviewId: obj.interviewId,
        type: obj.type,
        overallRating: obj.overallRating,
        feedbackText: (obj.feedbackText || '').slice(0, 80),
        createdAt: obj.createdAt,
      };
    });

    const recentTickets = (allTickets || []).slice(0, 10).map(t => {
      const obj = typeof t.toObject === 'function' ? t.toObject() : { ...t };
      return {
        _id: obj._id || obj.id,
        ticketId: obj.ticketId,
        subject: obj.subject,
        status: obj.status,
        userId: obj.userId,
        createdAt: obj.createdAt,
      };
    });

    res.json({
      success: true,
      stats: {
        revenue: `₹${revenue}`,
        revenueRaw: revenue,
        totalInterviews: interviews.length,
        interviewsToday,
        completedInterviews: completedInterviews.length,
        failedInterviews: failedInterviews.length,
        newUsers: users.length,
        totalUsers: allUsers.length,
        avgDuration,
        totalDuration,
        totalFeedbacks: feedbacks.length,
        totalTickets: tickets.length,
        openTickets: tickets.filter(t => t.status === 'Open').length,
      },
      recentInterviews,
      recentFeedbacks,
      recentTickets,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Provider Health ─────────────────────────────────────────────────
const getProviderHealth = async (req, res, next) => {
  try {
    // Return cached. Force refresh with ?refresh=true
    if (req.query.refresh === 'true') {
      await checkProviderHealth();
    }
    res.json({ success: true, health: providerHealthCache });
  } catch (error) {
    next(error);
  }
};

// ─── Interviews ──────────────────────────────────────────────────────
const getInterviews = async (req, res, next) => {
  try {
    const { page, limit, status, type, plan, search } = req.query;
    let interviews = await Interview.find({}).sort({ createdAt: -1 });

    if (status) interviews = interviews.filter(i => i.status === status);
    if (type) interviews = interviews.filter(i => i.interviewType === type);
    if (plan) interviews = interviews.filter(i => i.pricingTier === plan);
    if (search) {
      const s = search.toLowerCase();
      interviews = interviews.filter(i =>
        (i.role || '').toLowerCase().includes(s) ||
        (i._id || i.id || '').toLowerCase().includes(s)
      );
    }

    const result = paginate(interviews.map(i => {
      const obj = typeof i.toObject === 'function' ? i.toObject() : { ...i };
      delete obj.transcript; // Don't send full transcript in list
      delete obj.feedback;
      delete obj.recordingPath; // Security: don't expose file paths
      return obj;
    }), page, limit);

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const getInterviewDetail = async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    const obj = typeof interview.toObject === 'function' ? interview.toObject() : { ...interview };
    delete obj.recordingPath; // Don't expose raw file path
    obj.hasRecording = !!interview.recordingPath && !interview.recordingDeletedAt;

    res.json({ success: true, interview: obj });
  } catch (error) {
    next(error);
  }
};

// ─── Users ───────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, plan } = req.query;
    let users = await User.findAll();

    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u =>
        (u.name || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s) ||
        (u._id || u.id || '').toLowerCase().includes(s)
      );
    }

    // Sort by createdAt desc
    users.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);

    const sanitized = users.map(sanitizeUser);
    const result = paginate(sanitized, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const interviews = await Interview.find({ userId: String(user._id || user.id) });
    const feedbacks = await UserFeedback.find({ userId: String(user._id || user.id) });

    res.json({
      success: true,
      user: sanitizeUser(user),
      interviewCount: interviews.length,
      completedInterviews: interviews.filter(i => i.status === 'completed').length,
      feedbackCount: feedbacks.length,
    });
  } catch (error) {
    next(error);
  }
};

// ─── User Feedback ───────────────────────────────────────────────────
const getFeedbacks = async (req, res, next) => {
  try {
    const { page, limit, rating, type } = req.query;
    let feedbacks = await UserFeedback.find({}).sort({ createdAt: -1 });

    if (rating) feedbacks = feedbacks.filter(f => f.overallRating === Number(rating));
    if (type) feedbacks = feedbacks.filter(f => f.type === type);

    const result = paginate(
      feedbacks.map(f => (typeof f.toObject === 'function' ? f.toObject() : { ...f })),
      page, limit
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// ─── Tickets ─────────────────────────────────────────────────────────
const getTickets = async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;
    let tickets = await Ticket.find({}).sort({ createdAt: -1 });

    if (status) tickets = tickets.filter(t => t.status === status);
    if (search) {
      const s = search.toLowerCase();
      tickets = tickets.filter(t =>
        (t.ticketId || '').toLowerCase().includes(s) ||
        (t.subject || '').toLowerCase().includes(s)
      );
    }

    const result = paginate(
      tickets.map(t => {
        const obj = typeof t.toObject === 'function' ? t.toObject() : { ...t };
        delete obj.attachmentPath; // Don't expose file paths
        obj.hasAttachment = !!t.attachmentPath;
        return obj;
      }),
      page, limit
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!Ticket.VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    ticket.lastUpdatedBy = String(req.user._id || req.user.id);
    await ticket.save();

    res.json({ success: true, ticket: typeof ticket.toObject === 'function' ? ticket.toObject() : ticket });
  } catch (error) {
    next(error);
  }
};

// ─── Payments ────────────────────────────────────────────────────────
const getPayments = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    let interviews = await Interview.find({}).sort({ createdAt: -1 });

    // Filter only paid interviews (have paymentId)
    const paidItems = interviews.filter(i => i.paymentId);

    const payments = paidItems.map(i => {
      let amount = 0;
      let type = 'interview';
      if (i.recordingUnlocked && i.pricingTier !== 'pro') {
        // Check if this is a recording unlock vs interview payment
        if (!i.isPaid) {
          amount = 9;
          type = 'recording_unlock';
        } else {
          amount = i.pricingTier === 'basic' ? 9 : 19;
        }
      } else {
        amount = i.pricingTier === 'basic' ? 9 : i.pricingTier === 'pro' ? 19 : 0;
      }

      return {
        _id: i._id || i.id,
        userId: i.userId,
        interviewId: i._id || i.id,
        paymentId: i.paymentId,
        orderId: i.orderId,
        amount: `₹${amount}`,
        amountRaw: amount,
        type,
        pricingTier: i.pricingTier,
        status: 'success',
        createdAt: i.createdAt,
      };
    });

    const result = paginate(payments, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// ─── Export CSV ───────────────────────────────────────────────────────
const exportData = async (req, res, next) => {
  try {
    const { type } = req.params;
    let rows = [];
    let headers = [];

    if (type === 'interviews') {
      const interviews = await Interview.find({}).sort({ createdAt: -1 });
      headers = ['ID', 'User ID', 'Role', 'Type', 'Difficulty', 'Plan', 'Status', 'Duration (s)', 'Created At'];
      rows = interviews.map(i => [
        i._id || i.id, i.userId, i.role, i.interviewType, i.difficulty, i.pricingTier, i.status, i.actualDuration || '', i.createdAt,
      ]);
    } else if (type === 'users') {
      const users = await User.findAll();
      headers = ['ID', 'Name', 'Email', 'Verified', 'Role', 'Created At'];
      rows = users.map(u => [u._id || u.id, u.name, u.email, u.isVerified, u.role || 'user', u.createdAt]);
    } else if (type === 'feedbacks') {
      const feedbacks = await UserFeedback.find({}).sort({ createdAt: -1 });
      headers = ['ID', 'User ID', 'Interview ID', 'Type', 'Overall', 'Interview Quality', 'AI Voice', 'Questions', 'Recommend', 'Created At'];
      rows = feedbacks.map(f => [
        f._id || f.id, f.userId, f.interviewId, f.type, f.overallRating, f.interviewQualityRating, f.aiVoiceQualityRating, f.questionRelevanceRating, f.wouldRecommend, f.createdAt,
      ]);
    } else if (type === 'tickets') {
      const tickets = await Ticket.find({}).sort({ createdAt: -1 });
      headers = ['Ticket ID', 'Subject', 'Category', 'Status', 'User ID', 'Created At'];
      rows = tickets.map(t => [t.ticketId, t.subject, t.category, t.status, t.userId, t.createdAt]);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid export type.' });
    }

    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const csv = [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=mockmate_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getProviderHealth,
  getInterviews,
  getInterviewDetail,
  getUsers,
  getUserDetail,
  getFeedbacks,
  getTickets,
  updateTicketStatus,
  getPayments,
  exportData,
};
