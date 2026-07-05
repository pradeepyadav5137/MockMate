const UserFeedback = require('../models/UserFeedback');
const Interview = require('../models/Interview');

const getUserId = (req) => String(req.user?.id || req.user?._id || '');

/**
 * POST /api/user-feedback
 * Create a new user feedback submission.
 * Validates: authenticated user, one feedback per interview, required ratings.
 */
const createFeedback = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const {
      interviewId,
      type,
      overallRating,
      interviewQualityRating,
      aiVoiceQualityRating,
      questionRelevanceRating,
      feedbackText,
      wouldRecommend,
      helpfulFor,
      companyName
    } = req.body;

    const isTestimony = type === 'testimony';

    // Validate required fields
    if (!isTestimony && !interviewId) {
      return res.status(400).json({ success: false, message: 'Interview ID is required for improvement feedback.' });
    }

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ success: false, message: 'Overall rating (1-5) is required.' });
    }

    let interview = null;
    if (interviewId) {
      // Verify the interview belongs to this user
      interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found.' });
      }
      if (String(interview.userId) !== userId) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }

      // Check for duplicate submission for the same interview
      const existing = await UserFeedback.findByInterviewId(interviewId);
      if (existing && existing.type === type) {
        return res.status(409).json({ success: false, message: 'Feedback already submitted for this interview.' });
      }
    }

    // Extract actual provider info from interview record (if available)
    const ttsProvider = interview?.ttsProvider || null;
    const sttProvider = interview?.sttProvider || null;
    const llmProvider = interview?.llmProvider || null;

    const feedback = await UserFeedback.create({
      userId,
      interviewId: interviewId || '',
      type: type || 'testimony',
      overallRating: Number(overallRating),
      interviewQualityRating: Number(interviewQualityRating) || Number(overallRating),
      aiVoiceQualityRating: Number(aiVoiceQualityRating) || Number(overallRating),
      questionRelevanceRating: Number(questionRelevanceRating) || Number(overallRating),
      feedbackText: feedbackText || '',
      wouldRecommend: wouldRecommend || null,
      helpfulFor: helpfulFor || null,
      companyName: companyName || null,

      // Auto-stored metadata from interview record
      interviewCategory: interview?.interviewType || null,
      planUsed: interview?.pricingTier || null,
      ttsProvider,
      sttProvider,
      llmProvider,
      interviewDuration: interview?.actualDuration || null,
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully.',
      feedback: feedback.toObject ? feedback.toObject() : feedback,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user-feedback/my
 * Get all feedback submitted by the current user.
 */
const getMyFeedback = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const feedbacks = await UserFeedback.find({ userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      feedbacks: feedbacks.map((f) => (f.toObject ? f.toObject() : f)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user-feedback/check/:interviewId
 * Check if feedback already exists for an interview (duplicate prevention on frontend).
 */
const checkFeedback = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { interviewId } = req.params;

    const existing = await UserFeedback.findByInterviewId(interviewId);
    if (existing && String(existing.userId) === userId) {
      return res.json({ success: true, exists: true, feedback: existing.toObject ? existing.toObject() : existing });
    }
    res.json({ success: true, exists: false });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user-feedback/stats
 * Aggregate feedback stats (for future admin analytics).
 */
const getFeedbackStats = async (req, res, next) => {
  try {
    const allFeedback = await UserFeedback.find({}).sort({ createdAt: -1 });
    const total = allFeedback.length;

    if (total === 0) {
      return res.json({
        success: true,
        stats: {
          totalFeedbacks: 0,
          avgOverall: 0,
          avgInterviewQuality: 0,
          avgAiVoiceQuality: 0,
          avgQuestionRelevance: 0,
          recommendBreakdown: { Yes: 0, Maybe: 0, No: 0 },
          recentFeedbacks: [],
        },
      });
    }

    const avg = (field) => Math.round((allFeedback.reduce((sum, f) => sum + (f[field] || 0), 0) / total) * 10) / 10;

    const recommendBreakdown = { Yes: 0, Maybe: 0, No: 0 };
    allFeedback.forEach((f) => {
      if (f.wouldRecommend && recommendBreakdown.hasOwnProperty(f.wouldRecommend)) {
        recommendBreakdown[f.wouldRecommend]++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalFeedbacks: total,
        avgOverall: avg('overallRating'),
        avgInterviewQuality: avg('interviewQualityRating'),
        avgAiVoiceQuality: avg('aiVoiceQualityRating'),
        avgQuestionRelevance: avg('questionRelevanceRating'),
        recommendBreakdown,
        recentFeedbacks: allFeedback.slice(0, 10).map((f) => (f.toObject ? f.toObject() : f)),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createFeedback, getMyFeedback, checkFeedback, getFeedbackStats };
