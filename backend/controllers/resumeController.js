const User = require('../models/User');
const { extractResumeProfile } = require('../services/aiService');
const { uploadResume: saveResumeFile } = require('../services/storageService');

const parsePDF = async (buffer) => {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text;
};

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a PDF file.' });

    const userId = req.user.id || req.user._id;
    const stored = await saveResumeFile(req.file.buffer, `${Date.now()}-${req.file.originalname}`, userId);
    if (!stored.success) return res.status(500).json({ success: false, message: stored.error });

    let rawText = '';
    try { rawText = await parsePDF(req.file.buffer); } catch (e) { console.warn('PDF text extraction failed:', e.message); }

    let resumeProfile = { skills: [], technologies: [], projects: [], experience: [], education: [], summary: '' };
    if (rawText) {
      try { resumeProfile = await extractResumeProfile(rawText); } catch (e) { console.error('Resume profile extraction failed:', e.message); }
    }

    const user = await User.findByIdAndUpdate(userId, {
      resumeText: rawText.substring(0, 20000),
      resumeProfile,
    }, { new: true }).select('-password');

    res.json({
      success: true,
      message: 'Resume uploaded and processed successfully.',
      resume: { originalFileName: req.file.originalname, url: stored.url, profile: user.resumeProfile, processedAt: new Date() },
    });
  } catch (error) {
    next(error);
  }
};

const getResume = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).select('resumeProfile resumeText');
    if (!user?.resumeProfile) return res.status(404).json({ success: false, message: 'No resume found.' });
    res.json({ success: true, resume: { profile: user.resumeProfile, hasText: Boolean(user.resumeText) } });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadResume, getResume };
