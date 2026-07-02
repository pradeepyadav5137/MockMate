const Interview = require('../models/Interview');
const { getRecordingDownloadUrl } = require('../services/storageService');
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
    if (!interview.recordingPath || interview.recordingDeletedAt) {
      return res.status(404).json({ success: false, message: 'Recording not found or expired.' });
    }
    const downloadUrl = interview.recordingUnlocked
      ? (await getRecordingDownloadUrl(interview.recordingPath, interview._id)).url
      : null;
    res.json({
      success: true,
      recording: {
        url: downloadUrl,
        isDownloadable: interview.recordingUnlocked,
        expiresAt: interview.recordingExpiresAt,
        unlocked: interview.recordingUnlocked,
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
