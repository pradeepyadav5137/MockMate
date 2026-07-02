const cron = require('node-cron');
const Interview = require('./models/Interview');
const User = require('./models/User');
const cloudinary = require('cloudinary').v2;
const { sendEmail } = require('./services/emailService');

// Flag to prevent overlapping execution
let isCleanupRunning = false;

const startCronJobs = () => {
  // Hourly cron for reminders and cleanup
  cron.schedule('0 * * * *', async () => {
    if (isCleanupRunning) return;
    isCleanupRunning = true;
    
    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Fetch all interviews that have not had their recordings deleted
      const allInterviews = await Interview.find({ recordingDeletedAt: null });

      // 1. Reminders: recordingExpiresAt is within the next 2 hours AND recordingUnlocked === false AND no reminderEmailSent
      const toRemind = allInterviews.filter(
        (i) =>
          !i.recordingUnlocked &&
          !i.reminderEmailSent &&
          i.recordingExpiresAt &&
          new Date(i.recordingExpiresAt) > now &&
          new Date(i.recordingExpiresAt) <= twoHoursFromNow
      );

      for (const interview of toRemind) {
        try {
          const user = await User.findById(interview.userId);
          if (!user) continue;
          await sendEmail({
            to: user.email,
            subject: 'LAST CHANCE: Your mock interview recording expires in 2 hours',
            html: `Your interview recording will be deleted permanently in less than 2 hours. <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/interview/${interview._id}/unlock">Download Recording (₹9)</a>`,
          });
          interview.reminderEmailSent = true;
          await interview.save();
        } catch (e) {
          console.error(`Failed to send reminder for ${interview._id}:`, e.message);
        }
      }

      // 2. Cleanup: recordingExpiresAt < now()
      const toDelete = allInterviews.filter(
        (i) => i.recordingExpiresAt && new Date(i.recordingExpiresAt) < now
      );

      for (const interview of toDelete) {
        if (interview.recordingPublicId) {
          try {
            await cloudinary.uploader.destroy(interview.recordingPublicId, { resource_type: 'video' });
          } catch(e) {
            console.error(`Cloudinary destroy failed for ${interview.recordingPublicId}:`, e.message);
          }
        }
        
        console.log(`[CLEANUP] Deleted recording for Interview ${interview._id} (User: ${interview.userId}). Paid/Unlocked: ${interview.recordingUnlocked}`);
        
        interview.recordingDeletedAt = new Date().toISOString();
        interview.recordingUrl = null;
        interview.recordingPublicId = null;
        await interview.save();
      }
      
    } catch (e) {
      console.error('Error in cleanup cron:', e.message);
    } finally {
      isCleanupRunning = false;
    }
  });
};

module.exports = startCronJobs;
