const Interview = require('../models/Interview');
const feedbackService = require('../services/feedbackService');

const getUserId = (req) => String(req.user?.id || req.user?._id || '');

const loadOwnedInterview = async (req, res) => {
  const interview = await Interview.findById(req.params.interviewId);
  if (!interview) {
    res.status(404).json({ success: false, message: 'Interview not found.' });
    return null;
  }
  if (String(interview.userId) !== getUserId(req)) {
    res.status(403).json({ success: false, message: 'Unauthorized.' });
    return null;
  }
  return interview;
};

const getFeedback = async (req, res, next) => {
  try {
    const interview = await loadOwnedInterview(req, res);
    if (!interview) return;

    // Auto-complete in-progress interviews when user views feedback
    if (interview.status === 'in-progress' || interview.status === 'scheduled') {
      interview.status = 'completed';
      interview.completedAt = interview.completedAt || new Date().toISOString();
      interview.actualDuration = Math.round((Date.now() - new Date(interview.createdAt).getTime()) / 1000);
      interview.duration = interview.maxDurationMinutes;
      await interview.save();
    }

    if (!interview.feedback?.generatedAt) {
      if (interview.status === 'completed') {
        feedbackService.generateAndSave(interview._id).catch((err) => console.error('Feedback generation failed:', err.message));
      }
      return res.status(202).json({ success: false, message: 'Feedback generation in progress.', generating: true });
    }
    res.json({ success: true, feedback: interview.feedback, interview });
  } catch (error) {
    next(error);
  }
};

const getTranscript = async (req, res, next) => {
  try {
    const interview = await loadOwnedInterview(req, res);
    if (!interview) return;
    res.json({ success: true, transcript: interview.transcript || [] });
  } catch (error) {
    next(error);
  }
};

const getRecording = async (req, res, next) => {
  try {
    const interview = await loadOwnedInterview(req, res);
    if (!interview) return;

    // Recording expired or deleted
    if (interview.recordingDeletedAt || interview.recordingStatus === 'expired') {
      return res.json({
        success: true,
        recording: {
          status: 'expired',
          url: null,
          isDownloadable: false,
          expiresAt: interview.recordingExpiresAt,
          unlocked: interview.recordingUnlocked,
          pricingTier: interview.pricingTier,
        },
      });
    }

    if (!interview.recordingPath) {
      return res.json({
        success: true,
        recording: {
          status: interview.recordingStatus || (interview.status === 'completed' ? 'pending' : null),
          url: null,
          isDownloadable: false,
          expiresAt: interview.recordingExpiresAt,
          unlocked: interview.recordingUnlocked,
          pricingTier: interview.pricingTier,
        },
      });
    }

    // Recording exists — determine access
    const hasAccess = interview.pricingTier === 'pro' || interview.recordingUnlocked;
    const apiBase = `/api/storage/recordings/${interview._id}`;

    res.json({
      success: true,
      recording: {
        status: interview.recordingStatus || 'ready',
        url: hasAccess ? `${apiBase}/stream` : null,
        downloadUrl: hasAccess ? `${apiBase}/download` : null,
        isDownloadable: hasAccess,
        expiresAt: interview.recordingExpiresAt,
        unlocked: interview.recordingUnlocked,
        pricingTier: interview.pricingTier,
        locked: !hasAccess,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const interviews = await Interview.find({ userId: getUserId(req), status: 'completed' }).sort({ createdAt: -1 });
    const totalInterviews = interviews.length;
    const avg = (field) => totalInterviews ? Math.round(interviews.reduce((sum, i) => sum + (i.feedback?.[field] || 0), 0) / totalInterviews) : 0;
    res.json({
      success: true,
      stats: {
        totalInterviews,
        averageScore: avg('overallScore'),
        technicalScore: avg('technicalScore'),
        communicationScore: avg('communicationScore'),
        confidenceScore: avg('confidenceScore'),
        recentInterviews: interviews.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFeedback, getTranscript, getRecording, getDashboardStats };
