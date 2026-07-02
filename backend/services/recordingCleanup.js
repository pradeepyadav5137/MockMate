const cron = require('node-cron');
const Interview = require('../models/Interview');
const User = require('../models/User');
const { deleteRecording } = require('./storageService');
const emailService = require('./emailService');

// Runs every hour
const startCleanupCron = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Running recording cleanup...');
    try {
      const expired = await Interview.find({
        recordingDeletedAt: null,
      });

      // Filter client-side for expired recordings
      const now = new Date();
      const expiredRecordings = expired.filter(
        (i) => i.recordingPath && i.recordingExpiresAt && new Date(i.recordingExpiresAt) < now
      );

      for (const interview of expiredRecordings) {
        try {
          await deleteRecording(interview.recordingPath);
          interview.recordingDeletedAt = new Date().toISOString();
          interview.recordingPath = null;
          await interview.save();
          console.log(`✅ Deleted recording for interview ${interview._id}`);
        } catch (err) {
          console.error(`❌ Failed to delete ${interview._id}:`, err.message);
        }
      }

      // 2-hour reminder emails
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const needsReminder = expired.filter(
        (i) =>
          i.recordingPath &&
          !i.recordingUnlocked &&
          !i.reminderEmailSent &&
          i.recordingExpiresAt &&
          new Date(i.recordingExpiresAt) > now &&
          new Date(i.recordingExpiresAt) < twoHoursFromNow
      );

      for (const interview of needsReminder) {
        try {
          const user = await User.findById(interview.userId);
          if (user) {
            await emailService.sendReminderEmail(user, interview);
            interview.reminderEmailSent = true;
            await interview.save();
          }
        } catch (err) {
          console.error(`❌ Reminder email failed for ${interview._id}:`, err.message);
        }
      }

    } catch (err) {
      console.error('❌ Cleanup cron error:', err.message);
    }
  });
  console.log('✅ Recording cleanup cron started');
};

module.exports = { startCleanupCron };
