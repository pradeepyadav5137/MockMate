const Interview = require('../models/Interview');
const User = require('../models/User');
const { generateFeedback } = require('./aiService');
const { saveFeedbackReport } = require('./storageService');

const activeGenerations = new Set();

const buildFallbackFeedback = (interview, transcript, error) => {
  const totalMessages = Array.isArray(transcript?.messages) ? transcript.messages.length : 0;
  const summary = totalMessages
    ? `Feedback generation is temporarily unavailable, but your interview transcript was captured successfully with ${totalMessages} message(s).`
    : 'Feedback generation is temporarily unavailable, but your interview transcript was captured successfully.';

  return {
    overallScore: 55,
    technicalScore: 55,
    communicationScore: 55,
    confidenceScore: 55,
    problemSolvingScore: 55,
    summary,
    strengths: ['Interview completed successfully'],
    weaknesses: ['AI feedback generation was temporarily unavailable'],
    missedOpportunities: ['Retry once the AI provider is reachable'],
    improvementAreas: ['Review your transcript and practice your answers'],
    questionBreakdown: [],
    learningRoadmap: [],
    interviewerRemarks: 'Your interview has been completed. The feedback service is temporarily unavailable, but your transcript and interview state were preserved.',
    voiceSummary: '',
    generatedAt: new Date(),
    fallbackError: error?.message || 'Unknown feedback generation error',
  };
};

const generateAndSave = async (interviewId) => {
  const key = String(interviewId);
  if (activeGenerations.has(key)) {
    console.log(`Feedback generation already running for interview ${interviewId}`);
    return;
  }

  activeGenerations.add(key);
  try {
    const interview = await Interview.findById(interviewId);
    if (!interview) throw new Error("Interview not found");
    if (interview.feedback && interview.feedback.generatedAt) {
      console.log(`Feedback already generated for interview ${interviewId}`);
      return;
    }

    const user = await User.findById(interview.userId);
    
    // Format transcript for AI
    const transcript = {
      messages: interview.transcript || []
    };

    if (transcript.messages.length === 0) {
      console.warn(`No transcript found for interview ${interviewId}`);
    }

    console.log(`Generating feedback for interview ${interviewId}...`);
    
    let feedbackReport;

    // Short/empty interview: instant 0-score feedback
    if (transcript.messages.length < 2) {
      console.log(`Interview ${interviewId} has < 2 messages — generating minimal feedback.`);
      feedbackReport = {
        overallScore: 0,
        technicalScore: 0,
        communicationScore: 0,
        confidenceScore: 0,
        problemSolvingScore: 0,
        summary: 'Not enough data to generate detailed feedback. The interview was too short or no conversation took place.',
        strengths: [],
        weaknesses: ['Interview ended before meaningful conversation could occur'],
        missedOpportunities: ['Try to engage with the interviewer for at least a few minutes to receive actionable feedback'],
        improvementAreas: ['Complete a full interview session for comprehensive feedback'],
        questionBreakdown: [],
        learningRoadmap: [],
        interviewerRemarks: 'The interview session was too brief to evaluate. Please attempt a longer session for detailed feedback.',
        voiceSummary: '',
        generatedAt: new Date(),
      };
    } else {
      try {
        feedbackReport = await generateFeedback(
          interview,
          transcript,
          { profile: user ? user.resumeProfile : {} }
        );
      } catch (error) {
        console.warn(`AI feedback generation failed for ${interviewId}; using fallback feedback.`, error.message);
        feedbackReport = buildFallbackFeedback(interview, transcript, error);
      }
    }

    // Note: No voice summary generation as requested in SECTION 9

    interview.feedback = {
      overallScore: feedbackReport.overallScore ?? 0,
      technicalScore: feedbackReport.technicalScore ?? feedbackReport.scores?.technical ?? 0,
      communicationScore: feedbackReport.communicationScore ?? feedbackReport.scores?.communication ?? 0,
      confidenceScore: feedbackReport.confidenceScore ?? feedbackReport.scores?.confidence ?? 0,
      problemSolvingScore: feedbackReport.problemSolvingScore ?? feedbackReport.scores?.problemSolving ?? 0,
      summary: feedbackReport.summary,
      strengths: feedbackReport.strengths || [],
      weaknesses: feedbackReport.weaknesses || [],
      missedOpportunities: feedbackReport.missedOpportunities || [],
      improvementAreas: feedbackReport.improvementAreas || [],
      questionBreakdown: feedbackReport.questionBreakdown || [],
      learningRoadmap: feedbackReport.learningRoadmap || [],
      interviewerRemarks: feedbackReport.interviewerRemarks,
      voiceSummary: '',
      fallbackError: feedbackReport.fallbackError,
      generatedAt: new Date(),
    };
    
    await interview.save();
    console.log(`✅ Feedback successfully saved for interview ${interviewId}`);

    // Optional: Generate PDF and save using storageService
    // const pdfBuffer = await generatePdf(feedbackReport);
    // await saveFeedbackReport(pdfBuffer, interviewId);
    
  } catch (error) {
    console.error(`❌ Feedback generation failed for interview ${interviewId}:`, error.message);
    throw error; // Let the caller catch it
  } finally {
    activeGenerations.delete(key);
  }
};

module.exports = {
  generateAndSave
};
