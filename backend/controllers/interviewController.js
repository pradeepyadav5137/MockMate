const Interview = require('../models/Interview');
const UserDailyUsage = require('../models/UserDailyUsage');
const User = require('../models/User');
const { buildInterviewSystemPrompt } = require('../services/aiService');
const { AccessToken, RoomServiceClient, AgentDispatchClient } = require('livekit-server-sdk');
const feedbackService = require('../services/feedbackService');
const emailService = require('../services/emailService');

const tierMinutes = { free: 15, basic: 30, pro: 50 };
const validTypes = ['core_cs', 'dsa', 'system_design', 'hr', 'full_mix'];

const getUserId = (req) => String(req.user?.id || req.user?._id || '');
const isInternalRequest = (req) => req.headers['x-internal-key'] === process.env.JWT_SECRET;

const createInterview = async (req, res) => {
  try {
    const {
      interviewType,
      pricingTier = 'free',
      role = 'Software Engineer',
      difficulty = 'medium',
      voiceAccent = 'us-male',
    } = req.body;
    const userId = getUserId(req);

    if (!validTypes.includes(interviewType)) return res.status(400).json({ error: 'Invalid interview type' });

    if (process.env.SKIP_PAYMENT !== 'true') {
      if (!['free', 'basic', 'pro'].includes(pricingTier)) {
        return res.status(400).json({ error: 'Invalid pricing tier' });
      }
      if (interviewType === 'full_mix' && pricingTier !== 'pro') {
        return res.status(400).json({ error: 'Full Mix interview requires Pro tier (Rs.19). It covers all 5 categories and needs 50 minutes.' });
      }
      if (pricingTier === 'free') {
        const today = new Date().toISOString().split('T')[0];
        const usage = await UserDailyUsage.findOne({ userId, date: today });
        if (usage?.used) return res.status(403).json({ error: "You have used your free interview for today. Upgrade for Rs.9 to continue." });
        await UserDailyUsage.findOneAndUpdate({ userId, date: today }, { used: true }, { upsert: true, new: true });
      }
    }

    const finalTier = process.env.SKIP_PAYMENT === 'true' ? 'free' : pricingTier;
    const finalDuration = process.env.SKIP_PAYMENT === 'true' ? 15 : tierMinutes[pricingTier];

    const interview = await Interview.create({
      userId,
      role,
      interviewType,
      difficulty,
      voiceAccent,
      pricingTier: finalTier,
      maxDurationMinutes: finalDuration,
      status: 'scheduled',
      isPaid: finalTier !== 'free',
      recordingUnlocked: finalTier === 'pro',
    });

    res.status(201).json({ interviewId: interview._id, maxDurationMinutes: interview.maxDurationMinutes, interviewType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getLivekitToken = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized access to interview' });

    const user = await User.findById(interview.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const interviewMemory = interview.transcript?.length
      ? interview.transcript.map((m) => `${m.speaker}: ${m.text}`).join('\n').slice(-6000)
      : null;

    const systemPrompt = buildInterviewSystemPrompt({
      role: interview.role,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      phase: interview.currentPhase,
      resumeProfile: user.resumeProfile,
      interviewMemory,
      exchangesInPhase: interview.exchangesInPhase,
    });

    const roomName = `interview-${interview._id}`;
    const metadata = {
      systemPrompt,
      maxDuration: interview.maxDurationMinutes * 60,
      interviewType: interview.interviewType,
      isPaid: interview.isPaid,
      interviewId: interview._id.toString(),
      voiceAccent: interview.voiceAccent || 'us-male',
      roomName,
    };
    const metadataJson = JSON.stringify(metadata);

    if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      console.error('Missing LiveKit environment variables');
      return res.status(500).json({ error: 'LiveKit not configured' });
    }

    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    try {
      const roomOptions = {
        name: roomName,
        metadata: metadataJson,
        emptyTimeout: 60 * 5,
        maxParticipants: 10,
      };
      await roomService.createRoom(roomOptions);
      console.log(`Room ${roomName} created successfully`);
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('already')) {
        console.log(`Room ${roomName} already exists, updating metadata`);
        await roomService.updateRoomMetadata(roomName, metadataJson);
      } else {
        console.error('Room creation failed:', err.message);
        throw err;
      }
    }

    if (process.env.LIVEKIT_AGENT_NAME) {
      try {
        const dispatchClient = new AgentDispatchClient(
          process.env.LIVEKIT_URL,
          process.env.LIVEKIT_API_KEY,
          process.env.LIVEKIT_API_SECRET
        );
        const existingDispatches = await dispatchClient.listDispatch(roomName).catch(() => []);
        const alreadyDispatched = existingDispatches.some((d) => d.agentName === process.env.LIVEKIT_AGENT_NAME);
        if (!alreadyDispatched) {
          await dispatchClient.createDispatch(roomName, process.env.LIVEKIT_AGENT_NAME, { metadata: metadataJson });
          console.log(`Agent ${process.env.LIVEKIT_AGENT_NAME} dispatched to room ${roomName}`);
        } else {
          console.log(`Agent already dispatched to room ${roomName}`);
        }
      } catch (err) {
        if (String(err.message || '').toLowerCase().includes('already')) {
          console.log('Agent dispatch already exists');
        } else {
          console.error('Agent dispatch failed:', err.message);
        }
      }
    }

    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: `candidate-${user._id}`,
      name: user.name || 'Candidate',
      metadata: metadataJson,
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    if (interview.status === 'scheduled') {
      interview.status = 'in-progress';
      await interview.save();
    }

    res.json({
      token: await token.toJwt(),
      roomName,
      serverUrl: process.env.LIVEKIT_URL,
      maxDurationMinutes: interview.maxDurationMinutes,
      interviewType: interview.interviewType,
      role: interview.role,
      existingTranscript: interview.transcript || [],
      startedAt: interview.createdAt,
      success: true,
    });
  } catch (err) {
    console.error('getLivekitToken error:', err);
    res.status(500).json({ error: err.message });
  }
};

const endInterview = async (req, res) => {
  try {
    if (!req.user && !isInternalRequest(req)) return res.status(403).json({ error: 'Unauthorized' });
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (req.user && String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized' });

    interview.status = 'completed';
    interview.completedAt = new Date().toISOString();
    interview.actualDuration = Math.round((Date.now() - new Date(interview.createdAt).getTime()) / 1000);
    interview.duration = interview.maxDurationMinutes;
    interview.recordingExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await interview.save();

    feedbackService.generateAndSave(interview._id).catch((err) => console.error('Feedback generation failed:', err.message));
    emailService.sendRecordingNotification(interview.userId, interview._id).catch((err) => console.error('Email notification failed:', err.message));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFeedback = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized' });

    // Auto-complete in-progress interviews
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
      return res.status(202).json({ status: 'generating' });
    }
    res.json({ feedback: interview.feedback, recordingExpiresAt: interview.recordingExpiresAt, recordingUnlocked: interview.recordingUnlocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addTranscript = async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (!isInternalRequest(req) && String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized' });
  const speaker = req.body.role || req.body.speaker;
  const text = String(req.body.content || req.body.text || '').trim();
  const phase = req.body.phase || interview.currentPhase;
  if (!speaker || !text) return res.status(400).json({ error: 'Transcript speaker and text are required' });
  interview.transcript.push({ speaker, text, phase, timestamp: new Date() });
  if (speaker === 'assistant') interview.exchangesInPhase = (interview.exchangesInPhase || 0) + 1;
  await interview.save();
  res.json({ success: true });
};

const updateState = async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized' });
  if (req.body.phase) {
    interview.currentPhase = req.body.phase;
    interview.exchangesInPhase = 0;
  }
  await interview.save();
  res.json({ success: true });
};

const getAll = async (req, res) => {
  const interviews = await Interview.find({ userId: getUserId(req) }).sort({ createdAt: -1 });
  res.json({ interviews });
};

const getOne = async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized' });
  res.json({ interview });
};
const uploadRecording = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (String(interview.userId) !== getUserId(req)) return res.status(403).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No recording file provided' });

    const { saveRecording } = require('../services/storageService');
    const ext = req.file.mimetype === 'audio/webm' ? 'webm' : req.file.mimetype === 'audio/ogg' ? 'ogg' : 'webm';
    const filename = `interview.${ext}`;
    const result = await saveRecording(req.file.buffer, filename, interview._id);

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to save recording: ' + result.error });
    }

    interview.recordingPath = result.path;
    interview.recordingStatus = 'ready';
    interview.recordingExpiresAt = interview.recordingExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await interview.save();
    console.log(`✅ Recording saved for interview ${interview._id}`);

    // Send recording-ready email notification
    emailService.sendRecordingReadyEmail(interview.userId, interview._id).catch((err) =>
      console.error('Recording-ready email failed:', err.message)
    );

    res.json({ success: true, url: result.url });
  } catch (err) {
    console.error('Upload recording error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createInterview,
  getLivekitToken,
  endInterview,
  getFeedback,
  addTranscript,
  updateState,
  getAll,
  getOne,
  uploadRecording,
};